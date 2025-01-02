import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import { useFormContext } from "react-hook-form"
import { type Hash, getAddress } from "viem"
import {
  type Actor,
  type ActorOptions,
  type SnapshotFrom,
  fromPromise,
} from "xstate"
import { siloToSiloAddress } from "../../../constants/aurora"
import { depositEVMMachine } from "../../../features/machines/depositEVMMachine"
import { depositGenerateAddressMachineV2 } from "../../../features/machines/depositGenerateAddressMachineV2"
import { depositSolanaMachine } from "../../../features/machines/depositSolanaMachine"
import { depositTurboMachine } from "../../../features/machines/depositTurboMachine"
import { logger } from "../../../logger"
import {
  checkNearTransactionValidity,
  createApproveTransaction,
  createBatchDepositNearNativeTransaction,
  createBatchDepositNearNep141Transaction,
  createDepositEVMERC20Transaction,
  createDepositEVMNativeTransaction,
  createDepositFromSiloTransaction,
  createDepositSolanaTransaction,
  generateDepositAddress,
  getAllowance,
  waitEVMTransaction,
} from "../../../services/depositService"
import type { Transaction } from "../../../types/deposit"
import type { SwappableToken } from "../../../types/swap"
import { assetNetworkAdapter } from "../../../utils/adapters"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { getEVMChainId } from "../../../utils/evmChainId"
import { isBaseToken, isUnifiedToken } from "../../../utils/token"
import { depositGenerateAddressMachine } from "../../machines/depositGenerateAddressMachine"
import { depositNearMachine } from "../../machines/depositNearMachine"
import { depositUIMachine } from "../../machines/depositUIMachine"
import type { DepositFormValues } from "./DepositForm"

/**
 * We explicitly define the type of `depositUIMachine` to avoid:
 * ```
 * See description at @SwapUIMachineProvider.tsx
 * ```
 */
interface DepositUIMachineContextInterface {
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<typeof depositUIMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T
  useActorRef: () => Actor<typeof depositUIMachine>
  Provider: (props: {
    children: ReactNode
    options?: ActorOptions<typeof depositUIMachine>
    /** @deprecated Use `logic` instead. */
    machine?: never
    logic?: typeof depositUIMachine
    // biome-ignore lint/suspicious/noExplicitAny: it is fine `any` here
  }) => ReactElement<any, any>
}

export const DepositUIMachineContext: DepositUIMachineContextInterface =
  createActorContext(depositUIMachine)

interface DepositUIMachineProviderProps extends PropsWithChildren {
  tokenList: SwappableToken[]
  sendTransactionNear: (tx: Transaction["NEAR"][]) => Promise<string | null>
  sendTransactionEVM: (tx: Transaction["EVM"]) => Promise<Hash | null>
  sendTransactionSolana: (tx: Transaction["Solana"]) => Promise<string | null>
}

export function DepositUIMachineProvider({
  children,
  tokenList,
  sendTransactionNear,
  sendTransactionEVM,
  sendTransactionSolana,
}: DepositUIMachineProviderProps) {
  const { setValue } = useFormContext<DepositFormValues>()
  return (
    <DepositUIMachineContext.Provider
      options={{
        input: {
          tokenList,
        },
      }}
      logic={depositUIMachine.provide({
        actors: {
          depositNearActor: depositNearMachine.provide({
            actors: {
              signAndSendTransactions: fromPromise(async ({ input }) => {
                const { asset, amount, balance, storageDepositRequired } = input

                const tokenToDeposit = isBaseToken(asset)
                  ? asset
                  : asset.groupedTokens.find(
                      (token) => token.chainName === "near"
                    )

                assert(tokenToDeposit, "Token to deposit is not defined")

                let tx: Transaction["NEAR"][] = []

                if (tokenToDeposit.address === "wrap.near") {
                  tx = createBatchDepositNearNativeTransaction(
                    amount,
                    // If user does not have enough wrap.near we calculate how much native NEAR we need to wrap to match the amount to deposit
                    amount - (balance || 0n),
                    storageDepositRequired
                  )
                } else {
                  tx = createBatchDepositNearNep141Transaction(
                    tokenToDeposit.address,
                    amount,
                    storageDepositRequired
                  )
                }

                const txHash = await sendTransactionNear(tx)
                assert(txHash != null, "Transaction failed")
                return txHash
              }),
              validateTransaction: fromPromise(async ({ input }) => {
                const { txHash, accountId, amount } = input
                assert(txHash != null, "Tx hash is not defined")
                assert(accountId != null, "Account ID is not defined")
                assert(amount != null, "Amount is not defined")

                const isValid = await checkNearTransactionValidity(
                  txHash,
                  accountId,
                  amount.toString()
                )
                return isValid
              }),
            },
            guards: {
              isDepositValid: ({ context }) => {
                if (!context.txHash) return false
                return true
              },
            },
          }),
          depositGenerateAddressActor: depositGenerateAddressMachine.provide({
            actors: {
              generateDepositAddress: fromPromise(async ({ input }) => {
                const { userAddress, userChainType, chain } = input

                const address = await generateDepositAddress(
                  userAddressToDefuseUserId(userAddress, userChainType),
                  chain
                )

                return address
              }),
            },
          }),
          depositGenerateAddressV2Actor:
            depositGenerateAddressMachineV2.provide({
              actors: {
                generateDepositAddress: fromPromise(async ({ input }) => {
                  const { userAddress, blockchain, userChainType } = input

                  const address = await generateDepositAddress(
                    userAddressToDefuseUserId(userAddress, userChainType),
                    assetNetworkAdapter[blockchain]
                  )

                  return address
                }),
              },
            }),
          depositEVMActor: depositEVMMachine.provide({
            actors: {
              sendTransaction: fromPromise(async ({ input }) => {
                const {
                  asset,
                  amount,
                  tokenAddress,
                  depositAddress,
                  accountId,
                  chainName,
                } = input
                const chainId = getEVMChainId(chainName)

                assert(depositAddress != null, "Deposit address is not defined")

                let tx: Transaction["EVM"]
                if (isUnifiedToken(asset) && asset.unifiedAssetId === "eth") {
                  tx = createDepositEVMNativeTransaction(
                    accountId,
                    depositAddress,
                    amount,
                    chainId
                  )
                } else {
                  tx = createDepositEVMERC20Transaction(
                    accountId,
                    tokenAddress,
                    depositAddress,
                    amount,
                    chainId
                  )
                }

                logger.verbose("Sending transfer EVM transaction")
                const txHash = await sendTransactionEVM(tx)
                assert(txHash != null, "Transaction failed")

                logger.verbose("Waiting for transfer EVM transaction", {
                  txHash,
                })
                const receipt = await waitEVMTransaction({ txHash, chainName })
                if (receipt.status === "reverted") {
                  throw new Error("Transfer EVM transaction reverted")
                }

                return txHash
              }),
            },
            guards: {
              isDepositValid: ({ context }) => {
                if (!context.txHash) return false
                return true
              },
            },
          }),
          depositSolanaActor: depositSolanaMachine.provide({
            actors: {
              signAndSendTransactions: fromPromise(async ({ input }) => {
                const { amount, depositAddress, accountId } = input

                assert(depositAddress != null, "Deposit address is not defined")

                const tx = createDepositSolanaTransaction(
                  accountId,
                  depositAddress,
                  amount
                )
                const txHash = await sendTransactionSolana(tx)
                assert(txHash != null, "Transaction failed")

                return txHash
              }),
            },
            guards: {
              isDepositValid: ({ context }) => {
                if (!context.txHash) return false
                return true
              },
            },
          }),
          depositTurboActor: depositTurboMachine.provide({
            actors: {
              signAndSendTransactions: fromPromise(async ({ input }) => {
                const {
                  amount,
                  accountId,
                  tokenAddress,
                  depositAddress,
                  chainName,
                } = input

                const chainId = getEVMChainId(chainName)
                const siloToSiloAddress_ =
                  chainName in siloToSiloAddress
                    ? siloToSiloAddress[
                        chainName as keyof typeof siloToSiloAddress
                      ]
                    : null

                assert(siloToSiloAddress_ != null, "chainType should be EVM")

                if (tokenAddress !== "native") {
                  const allowance = await getAllowance(
                    tokenAddress,
                    accountId,
                    siloToSiloAddress_,
                    assetNetworkAdapter[chainName]
                  )
                  assert(allowance != null, "Allowance is not defined")

                  if (allowance < amount) {
                    const approveTx = createApproveTransaction(
                      tokenAddress,
                      siloToSiloAddress_,
                      amount,
                      getAddress(accountId),
                      chainId
                    )
                    logger.verbose("Sending approve EVM transaction")
                    const approveTxHash = await sendTransactionEVM(approveTx)
                    assert(approveTxHash != null, "Transaction failed")

                    logger.verbose("Waiting for approve EVM transaction", {
                      txHash: approveTxHash,
                    })
                    const receipt = await waitEVMTransaction({
                      txHash: approveTxHash,
                      chainName,
                    })
                    if (receipt.status === "reverted") {
                      throw new Error("Approve transaction reverted")
                    }
                  }
                }

                const tx = createDepositFromSiloTransaction(
                  tokenAddress === "native"
                    ? "0x0000000000000000000000000000000000000000"
                    : tokenAddress,
                  accountId,
                  amount,
                  depositAddress,
                  siloToSiloAddress_,
                  tokenAddress === "native" ? amount : 0n,
                  chainId
                )
                logger.verbose("Sending deposit from Silo EVM transaction")
                const txHash = await sendTransactionEVM(tx)
                assert(txHash != null, "Transaction failed")

                logger.verbose(
                  "Waiting for deposit from Silo EVM transaction",
                  { txHash }
                )
                const receipt = await waitEVMTransaction({ txHash, chainName })
                if (receipt.status === "reverted") {
                  throw new Error("Deposit from Silo transaction reverted")
                }

                return txHash
              }),
            },
            guards: {
              isDepositValid: ({ context }) => {
                if (!context.txHash) return false
                return true
              },
            },
          }),
        },
        actions: {
          clearUIDepositAmount: () => {
            setValue("amount", "")
          },
        },
      })}
    >
      {children}
    </DepositUIMachineContext.Provider>
  )
}
