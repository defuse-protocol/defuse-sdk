import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import { useFormContext } from "react-hook-form"
import { depositEVMMachine } from "src/features/machines/depositEVMMachine"
import type { Abi, SendTransactionParameters } from "viem"
import {
  type Actor,
  type ActorOptions,
  type SnapshotFrom,
  fromPromise,
} from "xstate"
import { settings } from "../../../config/settings"
import {
  checkNearTransactionValidity,
  createBatchDepositNearNativeTransaction,
  createBatchDepositNearNep141Transaction,
  createDepositEVMERC20Calldata,
  createDepositEVMNativeCalldata,
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
  sendTransactionNear: (transactions: Transaction[]) => Promise<string | null>
  sendTransactionEVM: (calldata: {
    to?: string
    data?: string
  }) => Promise<string | null>
}

export function DepositUIMachineProvider({
  children,
  tokenList,
  sendTransactionNear,
  sendTransactionEVM,
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

                let transactions: Transaction[] = []

                if (tokenAddress === "wrap.near") {
                  const isWrapNearRequired =
                    Number(amount) > Number(balance || 0n)
                  const minStorageBalance =
                    await getMinimumStorageBalance(tokenAddress)
                  transactions = createBatchDepositNearNativeTransaction(
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
                  transactions = createBatchDepositNearNep141Transaction(
                    tokenAddress,
                    amount,
                    isStorageRequired,
                    minStorageBalance
                  )
                }

                const txHash = await sendTransactionNear(transactions)
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
                const { accountId, chain } = input
                assert(accountId != null, "Account ID is not defined")
                assert(chain != null, "Chain is not defined")
                const address = await generateDepositAddress(
                  userAddressToDefuseUserId(accountId),
                  chain
                )
                console.log("generated address", address)
                return address
              }),
            },
          }),
          depositEVMActor: depositEVMMachine.provide({
            actors: {
              sendTransaction: fromPromise(async ({ input }) => {
                const { asset, amount, balance, tokenAddress } = input

                const generatedAddress =
                  "0xeF2EEC3F26A05c68AA4b25740477F3E998C10b55"

                assert(
                  generatedAddress != null,
                  "Generated address is not defined"
                )

                let calldata: { to?: string; data?: string } = {}
                if (isUnifiedToken(asset) && asset.unifiedAssetId === "eth") {
                  calldata = createDepositEVMNativeCalldata(
                    generatedAddress,
                    amount
                  )
                } else {
                  calldata = createDepositEVMERC20Calldata(
                    tokenAddress,
                    generatedAddress,
                    amount
                  )
                }

                const txHash = await sendTransactionEVM(calldata)

                return txHash ?? "unknown"
              }),
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
