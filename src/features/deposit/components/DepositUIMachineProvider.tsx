import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import { useFormContext } from "react-hook-form"
import { siloToSiloAddress } from "src/constants"
import { depositSolanaMachine } from "src/features/machines/depositSolanaMachine"
import { depositTurboMachine } from "src/features/machines/depositTurboMachine"
import { getNEP141StorageRequired } from "src/services/nep141StorageService"
import { type Hash, getAddress, stringify } from "viem"
import {
  type Actor,
  type ActorOptions,
  type SnapshotFrom,
  fromPromise,
} from "xstate"
import { settings } from "../../../config/settings"
import { depositEVMMachine } from "../../../features/machines/depositEVMMachine"
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
import { BlockchainEnum, ChainType } from "../../../types"
import type { SwappableToken, Transaction } from "../../../types"
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
  chainType?: ChainType
}

export function DepositUIMachineProvider({
  children,
  tokenList,
  sendTransactionNear,
  sendTransactionEVM,
  sendTransactionSolana,
  chainType,
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
                const { asset, amount, balance } = input

                const tokenAddress = isBaseToken(asset)
                  ? asset.address
                  : (asset.groupedTokens.find(
                      (token) => token.chainName === "near"
                    )?.address ?? null)

                assert(tokenAddress != null, "Token address is not defined")

                let tx: Transaction["NEAR"][] = []

                const storageDepositPayment = await getNEP141StorageRequired({
                  token: asset,
                  userAccountId: settings.defuseContractId,
                })

                assert(
                  storageDepositPayment.tag === "ok",
                  "Failed to get storage deposit payment amount"
                )

                if (tokenAddress === "wrap.near") {
                  tx = createBatchDepositNearNativeTransaction(
                    amount,
                    amount - (balance || 0n),
                    storageDepositPayment.value
                  )
                } else {
                  tx = createBatchDepositNearNep141Transaction(
                    tokenAddress,
                    amount,
                    storageDepositPayment.value
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

                console.log("Sending transfer EVM transaction")
                const txHash = await sendTransactionEVM(tx)
                assert(txHash != null, "Transaction failed")

                console.log(
                  "Waiting for transfer EVM transaction",
                  stringify({ txHash })
                )
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

                assert(
                  chainType !== null && chainType === ChainType.EVM,
                  "chainType should be EVM"
                )

                if (tokenAddress !== "native") {
                  const allowance = await getAllowance(
                    tokenAddress,
                    accountId,
                    siloToSiloAddress.turbochain,
                    BlockchainEnum.TURBOCHAIN
                  )
                  assert(allowance != null, "Allowance is not defined")

                  if (allowance < amount) {
                    const approveTx = createApproveTransaction(
                      tokenAddress,
                      siloToSiloAddress.turbochain,
                      amount,
                      getAddress(accountId),
                      chainId
                    )
                    console.log("Sending approve EVM transaction")
                    const approveTxHash = await sendTransactionEVM(approveTx)
                    assert(approveTxHash != null, "Transaction failed")

                    console.log(
                      "Waiting for approve EVM transaction",
                      stringify({ txHash: approveTxHash })
                    )
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
                  siloToSiloAddress.turbochain,
                  tokenAddress === "native" ? amount : 0n,
                  chainId
                )
                console.log("Sending deposit from Silo EVM transaction")
                const txHash = await sendTransactionEVM(tx)
                assert(txHash != null, "Transaction failed")

                console.log(
                  "Waiting for deposit from Silo EVM transaction",
                  stringify({ txHash })
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
