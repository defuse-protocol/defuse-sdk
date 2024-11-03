import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import {
  type Actor,
  type ActorOptions,
  type SnapshotFrom,
  fromPromise,
} from "xstate"
import { settings } from "../../../config/settings"
import type { SwappableToken, Transaction } from "../../../types"
import { BlockchainEnum } from "../../../types"
import { assert } from "../../../utils/assert"
import { isBaseToken } from "../../../utils/token"
import { depositGenerateAddressMachine } from "../../machines/depositGenerateAddressMachine"
import { depositNearMachine } from "../../machines/depositNearMachine"
import { depositUIMachine } from "../../machines/depositUIMachine"
import { DepositService } from "../services/depositService"

const depositNearService = new DepositService()

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
}

export function DepositUIMachineProvider({
  children,
  tokenList,
  sendTransactionNear,
}: DepositUIMachineProviderProps) {
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
                const { asset, amount, balance, accountId } = input
                assert(asset != null, "Asset is not selected")
                assert(amount != null, "Amount is not selected")
                assert(accountId != null, "Account ID is not selected")

                const tokenAddress = isBaseToken(asset)
                  ? asset.address
                  : (asset.groupedTokens.find(
                      (token) =>
                        `${token.chainName.toLowerCase()}:${token.chainId.toString()}` ===
                        BlockchainEnum.NEAR
                    )?.address ?? null)

                assert(tokenAddress != null, "Token address is not defined")

                let transactions: Transaction[] = []

                if (tokenAddress === "wrap.near") {
                  const isWrapNearRequired =
                    Number(amount) > Number(balance || 0n)
                  const minStorageBalance =
                    await depositNearService.getMinimumStorageBalance(
                      tokenAddress
                    )
                  transactions =
                    depositNearService.createBatchDepositNearNativeTransaction(
                      tokenAddress,
                      amount,
                      amount - balance,
                      isWrapNearRequired,
                      minStorageBalance
                    )
                } else {
                  const isStorageDepositRequired =
                    await depositNearService.isStorageDepositRequired(
                      tokenAddress,
                      settings.defuseContractId
                    )
                  const minStorageBalance =
                    await depositNearService.getMinimumStorageBalance(
                      tokenAddress
                    )
                  transactions =
                    depositNearService.createBatchDepositNearNep141Transaction(
                      tokenAddress,
                      amount,
                      isStorageDepositRequired,
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
                const isValid =
                  await depositNearService.checkNearTransactionValidity(
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
                const address = await depositNearService.generateDepositAddress(
                  accountId,
                  chain
                )
                console.log("generated address", address)
                return address
              }),
            },
          }),
        },
      })}
    >
      {children}
    </DepositUIMachineContext.Provider>
  )
}
