import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import { useFormContext } from "react-hook-form"
import { depositSolanaMachine } from "src/features/machines/depositSolanaMachine"
import type { Hash } from "viem"
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
  createBatchDepositNearNativeTransaction,
  createBatchDepositNearNep141Transaction,
  createDepositEVMERC20Transaction,
  createDepositEVMNativeTransaction,
  createDepositSolanaTransaction,
  generateDepositAddress,
  getMinimumStorageBalance,
  isStorageDepositRequired,
} from "../../../services/depositService"
import type { SwappableToken, Transaction } from "../../../types"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
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
                const { asset, amount, balance } = input

                const tokenAddress = isBaseToken(asset)
                  ? asset.address
                  : (asset.groupedTokens.find(
                      (token) => token.chainName === "near"
                    )?.address ?? null)

                assert(tokenAddress != null, "Token address is not defined")

                let tx: Transaction["NEAR"][] = []

                if (tokenAddress === "wrap.near") {
                  const isWrapNearRequired =
                    Number(amount) > Number(balance || 0n)
                  const minStorageBalance =
                    await getMinimumStorageBalance(tokenAddress)
                  tx = createBatchDepositNearNativeTransaction(
                    tokenAddress,
                    amount,
                    amount - balance,
                    isWrapNearRequired,
                    minStorageBalance
                  )
                } else {
                  const isStorageRequired = await isStorageDepositRequired(
                    tokenAddress,
                    settings.defuseContractId
                  )

                  let minStorageBalance = 0n
                  if (isStorageRequired) {
                    minStorageBalance =
                      await getMinimumStorageBalance(tokenAddress)
                  }
                  tx = createBatchDepositNearNep141Transaction(
                    tokenAddress,
                    amount,
                    isStorageRequired,
                    minStorageBalance
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
                const { asset, amount, tokenAddress, depositAddress } = input

                assert(depositAddress != null, "Deposit address is not defined")

                let tx: Transaction["EVM"] | null = null
                if (isUnifiedToken(asset) && asset.unifiedAssetId === "eth") {
                  tx = createDepositEVMNativeTransaction(depositAddress, amount)
                } else {
                  tx = createDepositEVMERC20Transaction(
                    tokenAddress,
                    depositAddress,
                    amount
                  )
                }
                assert(tx != null, "Transaction is not defined")

                const txHash = await sendTransactionEVM(tx)
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
