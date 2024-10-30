import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import { settings } from "src/config/settings"
import { depositGenerateAddressMachine } from "src/features/machines/depositGenerateAddressMachine"
import { depositNearMachine } from "src/features/machines/depositNearMachine"
import {
  DepositBlockchainEnum,
  type SwappableToken,
  type Transaction,
} from "src/types"
import { isBaseToken } from "src/utils"
import { assert } from "vitest"
import {
  type Actor,
  type ActorOptions,
  type SnapshotFrom,
  fromPromise,
} from "xstate"
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
                        DepositBlockchainEnum.NEAR
                    )?.address ?? null)

                assert(tokenAddress != null, "Token address is not defined")

                let transactions: Transaction[] = []

                if (Number(amount) > Number(balance || 0n)) {
                  transactions =
                    depositNearService.createBatchDepositNearTransaction(
                      settings.defuseContractId,
                      tokenAddress,
                      amount.toString(),
                      (BigInt(amount) - BigInt(balance || 0n)).toString()
                    )
                } else {
                  transactions =
                    depositNearService.createDepositNearTransaction(
                      settings.defuseContractId,
                      tokenAddress,
                      amount.toString()
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
