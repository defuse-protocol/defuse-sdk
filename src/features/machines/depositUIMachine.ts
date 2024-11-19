import { assetNetworkAdapter } from "src/utils/adapters"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
} from "xstate"
import type { SwappableToken } from "../../types"
import { BlockchainEnum } from "../../types"
import { parseUnits } from "../../utils/parse"
import { isBaseToken, isUnifiedToken } from "../../utils/token"
import { backgroundBalanceActor } from "./backgroundBalanceActor"
import {
  type Output as DepositEVMMachineOutput,
  depositEVMMachine,
} from "./depositEVMMachine"
import { depositEstimateMaxValueActor } from "./depositEstimationActor"
import {
  type Output as DepositGenerateAddressMachineOutput,
  DepositGeneratedDescription,
  depositGenerateAddressMachine,
} from "./depositGenerateAddressMachine"
import {
  type Output as DepositNearMachineOutput,
  depositNearMachine,
} from "./depositNearMachine"
import {
  type Output as DepositSolanaMachineOutput,
  depositSolanaMachine,
} from "./depositSolanaMachine"
import { poaBridgeInfoActor } from "./poaBridgeInfoActor"

export type Context = {
  error: Error | null
  balance: bigint
  nativeBalance: bigint
  /**
   * The maximum amount that available on the user's balance minus the cost of the gas.
   */
  maxDepositValue: bigint
  formValues: {
    token: SwappableToken | null
    network: BlockchainEnum | null
    amount: string
  }
  parsedFormValues: {
    amount: bigint
  }
  depositGenerateAddressRef: ActorRefFrom<
    typeof depositGenerateAddressMachine
  > | null
  poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
  tokenList: SwappableToken[]
  userAddress: string
  defuseAssetId: string | null
  tokenAddress: string | null
  generatedAddressResult: DepositGenerateAddressMachineOutput | null
  depositNearResult: DepositNearMachineOutput | null
  depositEVMResult: DepositEVMMachineOutput | null
  depositSolanaResult: DepositSolanaMachineOutput | null
}

export const depositUIMachine = setup({
  types: {
    input: {} as {
      tokenList: SwappableToken[]
    },
    context: {} as Context,
    events: {} as
      | {
          type: "INPUT"
          params: Partial<{
            token: SwappableToken
            network: BlockchainEnum | null
            amount: string
          }>
        }
      | {
          type: "SUBMIT"
        }
      | {
          type: "AUTO_SUBMIT"
        }
      | {
          type: "LOGIN"
          params: {
            userAddress: string
          }
        }
      | {
          type: "LOGOUT"
        },
    children: {} as {
      depositNearRef: "depositNearActor"
      depositEVMRef: "depositEVMActor"
      depositSolanaRef: "depositSolanaActor"
    },
  },
  actors: {
    fetchWalletAddressBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
    depositEVMActor: depositEVMMachine,
    depositSolanaActor: depositSolanaMachine,
    depositEstimateMaxValueActor: depositEstimateMaxValueActor,
  },
  actions: {
    setFormValues: assign({
      formValues: (
        { context },
        {
          data,
        }: {
          data: Partial<{
            token: SwappableToken
            network: BlockchainEnum | null
            amount: string
          }>
        }
      ) => ({
        ...context.formValues,
        ...data,
      }),
    }),
    parseFormValues: assign({
      parsedFormValues: ({ context }) => {
        try {
          return {
            amount: parseUnits(
              context.formValues.amount,
              context.formValues.token?.decimals ?? 0
            ),
            network: context.formValues.network,
            token: context.formValues.token,
          }
        } catch {
          return {
            amount: 0n,
            network: null,
            token: null,
          }
        }
      },
    }),
    clearError: assign({ error: null }),
    setDepositNearResult: assign({
      depositNearResult: (_, value: DepositNearMachineOutput) => value,
    }),
    setDepositEVMResult: assign({
      depositEVMResult: (_, value: DepositEVMMachineOutput) => value,
    }),
    setDepositSolanaResult: assign({
      depositSolanaResult: (_, value: DepositSolanaMachineOutput) => value,
    }),
    setDepositGenerateAddressResult: assign({
      generatedAddressResult: (_, value: DepositGenerateAddressMachineOutput) =>
        value,
    }),
    clearDepositResult: assign({ depositNearResult: null }),
    clearDepositEVMResult: assign({ depositEVMResult: null }),

    extractAssetIds: assign({
      defuseAssetId: ({ context }) => {
        if (context.formValues.token == null) {
          return null
        }
        if (isBaseToken(context.formValues.token)) {
          return context.formValues.token.defuseAssetId
        }
        return (
          context.formValues.token.groupedTokens.find(
            (token) =>
              assetNetworkAdapter[token.chainName] ===
              context.formValues.network
          )?.defuseAssetId ?? null
        )
      },
      tokenAddress: ({ context }) => {
        if (context.formValues.token == null) {
          return null
        }
        if (isBaseToken(context.formValues.token)) {
          return context.formValues.token.address
        }
        return (
          context.formValues.token.groupedTokens.find(
            (token) =>
              assetNetworkAdapter[token.chainName] ===
              context.formValues.network
          )?.address ?? null
        )
      },
    }),
    spawnGeneratedAddressActor: assign({
      depositGenerateAddressRef: (
        { spawn },
        output: { accountId: string; chain: BlockchainEnum }
      ) => {
        return spawn("depositGenerateAddressActor", {
          id: "deposit-generate-address",
          input: output,
        })
      },
    }),

    clearUIDepositAmount: () => {
      throw new Error("not implemented")
    },
    clearBalances: assign({
      balance: 0n,
      nativeBalance: 0n,
    }),

    fetchPOABridgeInfo: sendTo("poaBridgeInfoRef", { type: "FETCH" }),
  },
  guards: {
    isTokenValid: ({ context }) => {
      return !!context.formValues.token
    },
    isNetworkValid: ({ context }) => {
      return !!context.formValues.network
    },
    isLoggedIn: ({ context }) => {
      return !!context.userAddress
    },
    isDepositNearRelevant: ({ context }) => {
      return (
        context.balance + context.nativeBalance >=
          context.parsedFormValues.amount &&
        context.formValues.network === BlockchainEnum.NEAR
      )
    },
    isDepositEVMRelevant: ({ context }) => {
      return (
        context.balance + context.nativeBalance >=
          context.parsedFormValues.amount &&
        (context.formValues.network === BlockchainEnum.ETHEREUM ||
          context.formValues.network === BlockchainEnum.BASE ||
          context.formValues.network === BlockchainEnum.ARBITRUM)
      )
    },
    isDepositSolanaRelevant: ({ context }) => {
      return (
        context.balance + context.nativeBalance >=
          context.parsedFormValues.amount &&
        context.formValues.network === BlockchainEnum.SOLANA
      )
    },
    isBalanceSufficientForEstimate: ({ context }) => {
      if (context.formValues.token == null) {
        return false
      }
      const token = context.formValues.token
      // For all Native tokens, we should validate wallet native balance
      if (
        (isUnifiedToken(token) && token.unifiedAssetId === "eth") ||
        (isBaseToken(token) && token.address === "native")
      ) {
        return context.nativeBalance > 0n
      }
      return context.balance > 0n
    },
    isDepositNotNearRelevant: ({ context }) => {
      return (
        context.formValues.network != null &&
        context.formValues.network !== BlockchainEnum.NEAR &&
        !!context.userAddress &&
        !!context.defuseAssetId
      )
    },
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgAcIgEwA6AGziALHMbiAjI0UjZAGhABPYcuUBmRjLkBOAKzTDygOxLGtkQF9n2lB1yESFSuQCqACpMrEggnly8-EIIeLLKMhZJ0nbiFvaGttp6sQbGppbWdg5Oru5omF5EkpC4WDxQxADK-gBCALLUwSz8Edx8YTF4BiKSVoyMFiopqspm0tnCKVJmZoZmYiKG4rYWq2UgHpX41bVcDc1tncHKoezH-dH64iZzFoq2snLK0rbzi7EFGZJLZbHILKpDLJpN8XG5DhVON4ahA6hcWh0uvRxHdwg8ooNntJJIY9nIRONGGYjAoAXhScDlOCXvYLGIgQcjkjTqjzo06AAFIIhXr4gagIaZCyScQbOS2daMVS2ZR08TiUZ2NZiMyTaSMETkzmIqpYFFoqCSVAAJzAeBtaAAhtbHZEeMQRWE+gSJcJDHIpNI1kplBYqUGVIYAX8xvLjBTDDYE4ZjRFkWd6paHahna7+sQILwwJJYDhXcWuabzXyrbacy63Z77pxHoTcrriQZPiJlBrQ986b9Xgb9X8IXM-qnjuneZna06G-0agIwABjAhugD6toAjkRbQBbMA8HCwAtFktlnAVk0nM0Zhrz+t53jLtcb-rbsB7rCH4+nps8RbH1BH0OYpBeTJDX9DZ4wBUNRi+NQNU2eYjCnbl71nR9s1zN033XLdd33MAjxPWBJAAI0dAAbR0eFXYssAgGiwHPHgmJ4AA3dAAGtiwAMzAHBVwACwAdVo1icAAQQgCBbVgWBWlo+jGIAJTAATAO9cVQNyZQNBBaZSW2JINQsOlFDkSRGCDVY5FJWwdhVDCqwfLM6zwpcwBXQjP2I39SP-CiYA4xdH2Y1iPR6L0xSeXJ3ikBRDJ7CYjDmBZdGEExHF1OQgwsKFZDSGxxDcu9qznXDF1fXz3yI78SLI09JDCsAIstKK2PoW5RWAvShl7FJbLDAM7HSJQtjpXK-jUQrivVMaLAqmcLSfby6r8j9eC-H8-3Itrjw6vNH3q-zdvazr2M4nj+MkSscEoY6GzAOSFLgWBNO02LmzqECht7KQtREeYRD+aR3ijbLckMUZPipYbZF2BRpFWnl1pql8eAeoLVxwTdHr25qQskbqYtxXSEuGaRZDGQ0RDs8HabDcQAQKmy4csAqNUYMrrHRrDMa82qcdRW18cJ29iaClqKPJ3rKfitthm2WxJADP5FDsGwfjkdmYRJUH3lkRn+ZTeFHrWmssfw8W1wJonAoO1rHQPdACBPG6ye4vibwiABRUssAPct2kdAQADVaIIMBvp05XfVyJVRkcBQwUhtD5ABYxDBkCkjCsVk9lsQWSwISiD1wPlaDAZ1AgEb36ju-3jlr5149+oD-sGxAFXVyZvghxyzBeMxB3kSQzFZdZNkyRyy4IVAIHLFS6IYtiBFLctJEdATr2tAAKF4JgASgLW9kSXlfrzXtSwATgaEvmEEU7Zae1kM346VZMYIQ0RmBU2RGktpfaosAK5VxwHyAOkd2gNybr7e6j1YHtE7krJ+bZ+6jQDEVIeY06RhhMNSQ0hl5CTB2GXCBldq6ZiaOgdejoEGFg4j7FuD1bz0MYeg-qPcEoKjzgVNQ8oDQTiUHSTIwJQb2HJGocGqwtiuHhDwdAKB4BhCtkQXhbpqYn2BnYaQPY+zvFVDDYYEwpB-HylDOyoILblDTBjPk2jWxJ2GNzSQXZDG9h7CYukACZSrERhMIuiYy4eTJixMALiAb6FBnnPmVh4iMx2EyH+jMQSrFULTcwOxSThOwp5O0ttXHdx0SrTIUhTJGAVLIVmaSzHfBkEqQyYNKmORWqAxxQsbYi2xjE3uuRdijHmL8WU7wkn+h-mkWyaxMi2LWOIKEBThYLmxgRHaPAZYu3UX9cpbi7CqCnrTZy3NJn6zMXsEwex-TiBSAaRwmQVm9LWfhc6mztnBUOtRdejEBnUx+HTRyIYBEqHMCIQhfNZn+iZBDKYo9nnVT6W87ajV9pfNaj8++kTWL-JVj8JkGtjAqFBUyDYVlQxjDWN8eFUI1aIpwsinyqKApNVlqTLFG8HpFjxW4w00oVQGDMOSVJWQzFwzztBb4dz0ikg0Ayopz4UUNVZeiuWR1wqnSgLy-SNM6ajNORM2mUyzFLPVk4RyGh1h-E+BqBVG1RYbLRSTQ6V0tU4uiXFTBByUg2QNeM8ExqLk5GGGGGU0Fdgjkcple1JStoqt2s7DFoUXruveVuN1zivV8Pxf-RIYgJi0x2NSSyZjQwmA1I5AqUIgnzFjUy+NF0tlJvVZmucLDPV7NKUMflIIDChi1nzJw0MQ1GEkIAjQ5JPjCrBN8etrylz20lk7NlOydVDRVNchmTNPiQ3ETDFQyUkihkTHIvW86lWLrxo7aWLbSbdXXfoPYUhwZWENKsSwKgIUHtWFPcyBgR5zSsBezaYtr1SwiJ89VbsPYnkfbkAq6tyFKnBHDcGFIc4vFsk4eYahR5TCmCBx1S6b2QbvYdDt8G8BrGBBK5UI9aQw3BNKH4bJZh8xeCkIj6y41bMo9m-ZurfjEiWdrCYo8gyGPZsKwJbIln6neAocqXTpzgMgbQho7drQN3g7KdWvxLCmQDIzDsg4x0QjBPGcwcY0YqcwpIa+q9VIb3g8MjW+oRF5FhKWkN9gB7-wDFO5CVD1PQMzKgnTAnu2IFlKMCQig2QqhrZ8YNwhzDSkhj8XUkwJDqnlCFmhYWGhcPokwmIXbYkIGMCYP4UJZ1knBODCRhiNYjxeEksM9KlFAA */
  id: "deposit-ui",

  context: ({ input, spawn }) => ({
    error: null,
    balance: 0n,
    nativeBalance: 0n,
    maxDepositValue: 0n,
    formValues: {
      token: null,
      network: null,
      amount: "",
    },
    parsedFormValues: {
      amount: 0n,
    },
    depositNearResult: null,
    depositEVMResult: null,
    depositSolanaResult: null,
    depositGenerateAddressRef: null,
    tokenList: input.tokenList,
    userAddress: "",
    defuseAssetId: null,
    tokenAddress: null,
    generatedAddressResult: null,
    poaBridgeInfoRef: spawn("poaBridgeInfoActor", {
      id: "poaBridgeInfoRef",
    }),
  }),

  entry: ["fetchPOABridgeInfo"],

  on: {
    LOGIN: {
      actions: [
        assign({
          userAddress: ({ event }) => event.params.userAddress,
        }),
      ],
    },

    LOGOUT: {
      actions: [
        "clearDepositResult",
        "clearDepositEVMResult",
        "clearBalances",
        assign({
          userAddress: () => "",
          formValues: {
            token: null,
            network: null,
            amount: "",
          },
        }),
      ],
    },
  },

  states: {
    editing: {
      initial: "idle",

      on: {
        SUBMIT: [
          {
            target: "submittingNearTx",
            guard: "isDepositNearRelevant",
            actions: "clearDepositResult",
          },
          {
            target: "submittingEVMTx",
            reenter: true,
            guard: "isDepositEVMRelevant",
          },
          {
            target: "submittingSolanaTx",
            reenter: true,
            guard: "isDepositSolanaRelevant",
          },
        ],

        INPUT: {
          target: ".pre-preparation",
          actions: [
            "clearError",
            {
              type: "setFormValues",
              params: ({ event }) => ({ data: event.params }),
            },
            "parseFormValues",
          ],
        },
      },

      states: {
        idle: {},

        "pre-preparation": {
          always: {
            target: "preparation",
            guard: and(["isTokenValid", "isNetworkValid", "isLoggedIn"]),
          },
        },

        preparation: {
          entry: "extractAssetIds",
          initial: "execution_requirements",

          states: {
            execution_requirements: {
              type: "parallel",

              states: {
                balance: {
                  initial: "idle",
                  states: {
                    idle: {
                      invoke: {
                        id: "fetchWalletAddressBalanceRef",
                        src: "fetchWalletAddressBalanceActor",

                        input: ({ context }: { context: Context }) => {
                          assert(context.formValues.network, "network is null")
                          assert(context.defuseAssetId, "defuseAssetId is null")
                          assert(context.tokenAddress, "tokenAddress is null")
                          assert(context.userAddress, "userAddress is null")

                          return {
                            defuseAssetId: context.defuseAssetId,
                            tokenAddress: context.tokenAddress,
                            userAddress: context.userAddress,
                            network: context.formValues.network,
                            token: context.formValues.token,
                          }
                        },

                        onDone: {
                          target: "done",
                          actions: assign({
                            balance: ({ event }) => event.output?.balance ?? 0n,
                            nativeBalance: ({ event }) =>
                              event.output?.nativeBalance ?? 0n,
                          }),
                        },
                      },
                    },

                    done: {
                      type: "final",
                    },
                  },
                },

                generating: {
                  initial: "idle",

                  states: {
                    idle: {
                      always: [
                        {
                          target: "execution_generating",
                          guard: "isDepositNotNearRelevant",
                        },
                        {
                          target: "done",
                        },
                      ],
                    },
                    execution_generating: {
                      invoke: {
                        id: "depositGenerateAddressRef",
                        src: "depositGenerateAddressActor",

                        input: ({ context }) => {
                          assert(context.formValues.network, "network is null")

                          return {
                            accountId: context.userAddress,
                            chain: context.formValues.network,
                          }
                        },

                        onDone: {
                          target: "done",
                          guard: {
                            type: "isOk",
                            params: ({ event }) => event.output,
                          },

                          actions: [
                            {
                              type: "setDepositGenerateAddressResult",
                              params: ({ event }) => event.output,
                            },
                          ],
                        },
                      },
                    },

                    done: {
                      type: "final",
                    },
                  },
                },
              },

              onDone: "direct_deposit_requirements",
            },

            direct_deposit_requirements: {
              initial: "idle",

              states: {
                idle: {
                  always: [
                    {
                      target: "amount",
                      guard: "isBalanceSufficientForEstimate",
                    },
                    {
                      target: "done",
                    },
                  ],
                },
                amount: {
                  invoke: {
                    id: "depositEstimateMaxValueRef",
                    src: "depositEstimateMaxValueActor",

                    input: ({ context }: { context: Context }) => {
                      assert(context.formValues.token, "token is null")
                      assert(context.formValues.network, "network is null")
                      assert(context.tokenAddress, "tokenAddress is null")

                      return {
                        token: context.formValues.token,
                        network: context.formValues.network,
                        balance: context.balance,
                        nativeBalance: context.nativeBalance,
                        tokenAddress: context.tokenAddress as string,
                        userAddress: context.userAddress,
                        // It is optional cause for NEAR estimation we don't need to generate an address
                        generateAddress:
                          context.generatedAddressResult?.tag === "ok"
                            ? context.generatedAddressResult.value
                                .depositAddress
                            : null,
                      }
                    },

                    onDone: {
                      target: "done",
                      actions: assign({
                        maxDepositValue: ({ event }) => event.output,
                      }),
                    },
                  },
                },
                done: {
                  type: "final",
                },
              },
            },

            preparation_done: {
              type: "final",
            },
          },

          onDone: "idle",
        },
      },
    },

    submittingNearTx: {
      invoke: {
        id: "depositNearRef",
        src: "depositNearActor",

        input: ({ context }) => {
          assert(context.formValues.token, "token is null")
          assert(context.userAddress, "userAddress is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
          }
        },

        onDone: {
          target: "updateBalance",

          actions: [
            {
              type: "setDepositNearResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },

    // Delay the request by 2 seconds to ensure accurate balance retrieval due to NEAR RPC latency issues.
    updateBalance: {
      after: {
        "2000": {
          target: "editing.preparation",
          reenter: true,
        },
      },
    },

    submittingEVMTx: {
      invoke: {
        id: "depositEVMRef",
        src: "depositEVMActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")
          const depositAddress =
            context.generatedAddressResult?.tag === "ok"
              ? context.generatedAddressResult.value.depositAddress
              : null

          assert(context.formValues.network, "network is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(depositAddress, "depositAddress is null")
          assert(context.formValues.token, "token is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
            depositAddress,
          }
        },

        onDone: {
          target: "updateBalance",

          actions: [
            {
              type: "setDepositEVMResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },

    submittingSolanaTx: {
      invoke: {
        id: "depositSolanaRef",
        src: "depositSolanaActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")
          const depositAddress =
            context.generatedAddressResult?.tag === "ok"
              ? context.generatedAddressResult.value.depositAddress
              : null

          assert(context.formValues.network, "network is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(depositAddress, "depositAddress is null")
          assert(context.formValues.token, "token is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
            depositAddress,
          }
        },

        onDone: {
          target: "updateBalance",

          actions: [
            {
              type: "setDepositSolanaResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
