import { assetNetworkAdapter } from "src/utils/adapters"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
  spawnChild,
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
    },
  },
  actors: {
    fetchWalletAddressBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
    depositEVMActor: depositEVMMachine,
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
    isBalanceSufficientForEstimate: ({ context }) => {
      if (context.formValues.token == null) {
        return false
      }
      const token = context.formValues.token
      // For all Native tokens, we should validate wallet native balance
      if (isUnifiedToken(token) && token.unifiedAssetId === "eth") {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgAcIgEwA6AGziALHMbiAjI0UjZAGhABPYcuUBmRjLkBOAKzTDygOxLGtkQF9n2lB1yESFSuQCqACpMrEggnly8-EIIeLLKMhZJ0nbiFvaGttp6sQbGppbWdg5Oru5omF5EkpC4WDxQxADK-gBCALLUwSz8Edx8YTGykhZyhum2huKGM7ZO0tnC4tLSkoqGsvZJImZyymUgHpX41bVcDc1tncHKoezH-dGI0iZmjBIqGkq2druLuXILGtGJYnPZlmlRgcjpxvDUIHULnQAApBEK9B5RQb6ESGSTjWziRiMQzqSzKBa6JbiERrUbWMziMy2N42MzQiqw04I85QSSoABOYDwgrQAEMBWLIjxiOiwn0saAYnhlBYTLYLHYNiozNIxBZxP8dpJlprbNIksTSekORE4Wd6nzRagJVL+sQILwwJJYDgpd6YVUsPDEU6hS7JdK5fdOI9sbk3qsDOaRMoaaq9v84vZJKovizNcpmey3IdOUGQ7z+eHXdKagIwABjAjSgD6QoAjkQhQBbMA8HCwD1en1+nAB8snYMOhrV8WR-r1pst-rtsBdrC9-uD6PhTEDJXCCy4yQ-ClmN7EorKf7TPHvVKOCzGTa2W3He08x1ziNu3hL5s207bswD7Ach09HhvV9f1JEDKdK2-Z1a0XMAG0A1dgM3UDt1gehbgxWNFUEYQ5BEV4NEmZYLwMNJ-jZSQRDVNMdhmV9DHfLlpy-WdkIXf80OXID1xAsDB0kAAjMUABsxR4RtvSwCBpLAYcoMkeoADd0AAa29AAzMAcEbAALAB1GSVJwABBCAICFWBYFaGS5IUgAlMB9N3BUDxI3JlA0U8VGsZ9IRpCws0UORJEYaQL12AlxDmfZS3gz9Qx-FCBPQldeDXDct3AyQYCghdZyUlTZR6eV9yeAEbDWFZCUsQEVlJf4yM4isZzDec-x4ADcp4fLRNw4r+zAMq+UEjC8pKya3QuSDFJ4bS9LgydKAmyMwFs+y4FgDyvOqmM6mInJdW0ZUDACyRdWkZrRisaw5C6hCesy-iBoRIVGxwVt4JG7CxNgSQxR7dACAHDTlNU5aNNW3SJwiABRX0sB7f12jFAQADUZIIMAju82r4xVOxbFzMilBeAxrEMMx-jVWkfiS5kxDMNNJjeuFYAICSe1wXlaDACVAgENSVrW5HjhFiViZOvciN8mIdhMMiiTVFk7zkSkcjwJLaUMcjz2fIxxh56oCFQCB-Wc2T5NUgQYPHMH9PHAUAAoiWJABKD1Jzha3bfHe3XLAEnlbqpLKfI0YxF1zJjzkLNxlpXVVVi6ifhLco7WqPmBaFx0Udx9pxclhHpY21Gy4Vu4lbOlXEB2BIAs1TmJGUORCRvKlck1GQNAJRw5HkH4OIOHh0BQeAwjSohCKbuqDeJKRkz1FiMz7-XVCUU8L0ccjmSo17UsD7lQyX6UV6LUZczsTf01GHfhA0WkmTeMwmPNaZc7LfO3EMoVTANfOMh5cisRiuMFYnxvjdyzE4dUNFYrSHMElC259AGIV4kKEUNYvpgOItdCwZh8QGgvLMCQjBnwiEipTcY7w0GjHMJzZ6lsgFVj4v1IhzdcganTk1JkT02op37ngOYUgQQzBJKoA0ywUp5w-JfLhBD+qDWEgVHC4FeG3x+K8IRLVnrtXEdYSmpCZhGEYEWWwYxxAcJwb1X8dYZpDSBoVcSUkHYKV0WTCkwwxhKC1FMbu38syWhimYGYKgQQxzmA4j63CXE5U0aNIqXjw4wxUr4iBKoUjRUCSoSYITzB0PEXsIEFiKlMg2FMN8WDlGcKQmo5JQlMIiWBmNDJjs4JehyX5UQgJTw3V2BIH4WRxHGzxCIMYexTSTGPNIBJPEnFZQGq41JnSirzSmv066sC7qGJES9LM0xKZODGA9axMxmRnyUVxRxn11EbPaVokG41SqLT5CAvZ+h8mHIesI1qJzxGZxNDMpOTCxhFiWQ0h5iSWmoRSa8tJ4kdlfI0audFvJfm5H+fdR6wKTEXVhfc7qKynmtNmsNLCHjQbYu-MtXFEiZkyAtLchwpJGagtus+MYhJATWPSDsZZGUkmLh+k2f6gNaXaMHMy4oZCTYBXugyQk9FxDr1YjTeQcUAqitUX1Oskq-oA0nO4uVoNwaQwHAqlYCRlU7BWGqw0-dFBkL1IyXYSQKTpHsXC8lYrEX-hNdK81sr3nWqhjgLJoCapRz8SkaZ1iVXOoZuqt1zJcw7BpGg+YmqLQGuaUaiV2FTUyo6XSsGENo29Kgsy3EeJVBkW-iSOYbwJk5ANOnBmmRLBq1akW3BJb-ziryky+Ny8yY91pEYIwepkhqj1ogMeeJNXjLUC-XW0wHGF0FjgYWosBTi1xczEYC7v4Ggqc+QwpyVh3SSo4b+bUGY2gDQhYOdsXKO1xVEshVh3WWHZseV1+sNjq3yeRfRj9J5koQnu4uDRS7lxiKdG+8Y1RkInnvFk5pZARVBYoE00Tu56jHnfVwrggA */
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
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
