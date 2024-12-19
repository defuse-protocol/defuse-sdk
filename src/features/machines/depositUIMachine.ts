import { settings } from "src/config/settings"
import {
  assetNetworkAdapter,
  reverseAssetNetworkAdapter,
} from "src/utils/adapters"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
} from "xstate"
import type { ChainType, SwappableToken } from "../../types"
import { BlockchainEnum } from "../../types"
import { parseUnits } from "../../utils/parse"
import { isBaseToken, isNativeToken, isUnifiedToken } from "../../utils/token"
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
import {
  type Output as DepositTurboMachineOutput,
  depositTurboMachine,
} from "./depositTurboMachine"
import { poaBridgeInfoActor } from "./poaBridgeInfoActor"

export type Context = {
  error: null | {
    tag: "err"
    value: {
      reason: "ERR_GET_BALANCE"
      error: Error | null
    }
  }
  balance: bigint
  nativeBalance: bigint
  /**
   * The maximum amount that available on the user's balance minus the cost of the gas.
   * todo: either remove this, or make it work, now it is 0n for native tokens
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
  userAddress: string | null
  userChainType: ChainType | null
  defuseAssetId: string | null
  tokenAddress: string | null
  generatedAddressResult: DepositGenerateAddressMachineOutput | null
  depositNearResult: DepositNearMachineOutput | null
  depositEVMResult: DepositEVMMachineOutput | null
  depositSolanaResult: DepositSolanaMachineOutput | null
  depositTurboResult: DepositTurboMachineOutput | null
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
            userChainType: ChainType
          }
        }
      | {
          type: "LOGOUT"
        },
    children: {} as {
      depositNearRef: "depositNearActor"
      depositEVMRef: "depositEVMActor"
      depositSolanaRef: "depositSolanaActor"
      depositTurboRef: "depositTurboActor"
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
    depositTurboActor: depositTurboMachine,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      console.error(event.error)
    },
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>["value"]) => ({
        tag: "err" as const,
        value: error,
      }),
    }),

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
    setDepositTurboResult: assign({
      depositTurboResult: (_, value: DepositTurboMachineOutput) => value,
    }),
    setDepositGenerateAddressResult: assign({
      generatedAddressResult: (_, value: DepositGenerateAddressMachineOutput) =>
        value,
    }),
    clearDepositResult: assign({ depositNearResult: null }),
    clearDepositEVMResult: assign({ depositEVMResult: null }),
    clearGeneratedAddressResult: assign({ generatedAddressResult: null }),
    clearDepositSolanaResult: assign({ depositSolanaResult: null }),
    clearDepositTurboResult: assign({ depositTurboResult: null }),
    clearResults: assign({
      depositNearResult: null,
      depositEVMResult: null,
      depositSolanaResult: null,
      depositTurboResult: null,
      generatedAddressResult: null,
    }),

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
    isChainNearSelected: ({ context }) => {
      return context.formValues.network === BlockchainEnum.NEAR
    },
    isChainEVMSelected: ({ context }) => {
      return (
        context.formValues.network === BlockchainEnum.ETHEREUM ||
        context.formValues.network === BlockchainEnum.BASE ||
        context.formValues.network === BlockchainEnum.ARBITRUM
      )
    },
    isChainSolanaSelected: ({ context }) => {
      return context.formValues.network === BlockchainEnum.SOLANA
    },
    isChainAuroraEngineSelected: ({ context }) => {
      return (
        context.formValues.network === BlockchainEnum.TURBOCHAIN ||
        context.formValues.network === BlockchainEnum.AURORA
      )
    },
    isBalanceSufficientForEstimate: ({ context }) => {
      if (context.formValues.token == null) {
        return false
      }
      const token = context.formValues.token
      // For all Native tokens, we should validate wallet native balance
      if (
        (isUnifiedToken(token) && token.groupedTokens.some(isNativeToken)) ||
        (isBaseToken(token) && isNativeToken(token))
      ) {
        return context.nativeBalance > 0n
      }
      return context.balance > 0n
    },
    isPassiveDepositEnabledForSelectedChain: ({ context }) => {
      return (
        context.formValues.network != null &&
        context.formValues.network !== BlockchainEnum.NEAR &&
        context.formValues.network !== BlockchainEnum.TURBOCHAIN &&
        context.formValues.network !== BlockchainEnum.AURORA &&
        !!context.userAddress &&
        !!context.defuseAssetId
      )
    },
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgAcIgEwA6AGziALHMbiAjI0UjZAGhABPYcuUBmRjLkBOAKzTDygOxLGtkQF9n2lB1yESFSuQCqACpMrEggnly8-EIIeLLKMhZJ0nbiFvaGttp6sQbGppbWdg5Oru5omF5EkpC4WDxQxADK-gBCALLUwSz8Edx8YTF4BiKSVoyMFiopqspm0tnCKVJmZoZmYiKG4rYWq2UgHpX41bVcDc1tncHKoezH-dH64iZzFoq2snLK0rbzi7EFGZJLZbHILKpDLJpN8XG5DhVON4ahA6hcWh0uvRxHdwg8ooNntJJIY9nIRONGGYjAoAXhScDlOCXvYLGIgQcjkjTqjzo0Mdd6IZcX0CaAhkZgeIREYXoxlHtGCJyXTxNJicoKYxjGY5OIVHJDJzEVUsCi0Y06AAFIIhXr4gbi4SZCyScQbOS2dbyxzKVXSyR2NZiMyTaRK8nGiLIs71KCSVAAJzAeCTaAAhon05EeMQ7WFRY7BM69TI1koFVTpGYVIYAX8xp7jBTDDYW0b4VzTea+Qnk6hM9n+sQILwwJJYDhs+OuyczbGGn2M1mc-n7pxHoTcqGNXZpDLpQrvnTfq8leG-hC5n8o8cY7y40uByv+jUBGAAMYEHMAfWTAEciGTABbMAeBwWARzHCcpxwGcTTnHtHzTZ8h14N9P2-fo-zAQCsBAsCILXPENzFYtcjmKQXkyZVDHMLYlQBBVRi+NRpU2eYjFvbl5wfRcUMHHMMK-X8AKAsBQPA2BJAAI3TAAbdMeA-ccsAgeSwCgnhVJ4AA3dAAGtxwAMzAHAPwACwAdQUjScAAQQgCBk1gWBWgUpSVIAJTAYziMLJ4KI0EFplJbYkmlCw6UUORJEYatVkNdIdlsZRuO7Bd4wEl90LAd8ROwsT8IkwjpJgbSX0XNSNLzHoCwdQLhneKQFE1GUJiMOYFl0YQTEcUM5GrCwoVkNIbHEdLEMyp9BNfPLMNE3DxMkiDJHKsBKvjarNPoW57VIosJTVBJJjYux0iULY6T6v41CGkb9QsNQLEm+8LRmnKeGErDeBwvCCKktawI2odF3mgrfvWzatJ0-SjMkWdKGBlcwEc5y4FgHy-Lq9c6jIiVlH1QM-hEeYRD+aR3jrHrckMUZPipQn1R2d5Btenl3uytCvtRZMPxwH9Zz+5bSskbbapFBqt2GZmxmVER4vJ9UnvEAFBtiunLEG6VtSZjtymjDney5oTec-AWhaKgHVvF3bJYOxrZVsSQ9T+RQ7BsH45DVmESVJ95ZAV8brHZ3jOf7Wb0LN-nBYQ4XipW6T02A9ACHAmGxb0wz4IiABRScsGA6d2nTAQADUFIIMAsf8qWnVyeVRkcBQwUpzj5ABYxDBkCkjCsVk9lsUOJwIGTgNwPlaDATNAgEDP6jhnPjinzMa5xki8cOxAvWdyZvgpw0aypE95EkMxWXWTZMkNYeCFQCBp3cxTlM0gRJ2nSR02MuDEwACjlRgABKEcCFkR3wfnBJ+nkwC1wdlueYIJG5snPmsTUvw6SsjGBCDQCtBpskjJ2UB1RYCj3HjgPkucy7tFnvPLO8NZyUPaGve2m9Ao7zis1Ya+8nrexpngJ6JhqTKk1PISYOxh4kLHhPOMTR0DP3TDQ0c2lM6LwRghWR8jmH7VYVuL03dBpqE9Eqa8Sg6SZGBKTew5I1Dk1WFsCRpDpENECAQRMMl0CKOggvbOaiIguLcegLR9U4H1z0S7cM6xJQKBmKqckbplgQnlF6A80hXDwh4OgFA8Awizm8NonMjU5RSAMJ8A8Mp3h+j4aoJQIJVjxVbHMS+Q9CGGzDnyfJm567DC1oGPcZSjyVJyKIfcbo6lglWGqeYzSDZ3iNo+baHT8b6FJt3bUVh4gKx2EyDBCtanUnijCGsXoXotNmW05CyZUwR0+osresRMhSDCkYL0sgVbbL4d8GQ8pNRkweUlYe00TadI3gU6W51RjzF+O6d46y6IYLSHFNYsJz6URUACviWVrnc2+otf6JUpK3MdqlQR6pbDQvBOqOFfDFRjDWHTYaLJrATVOTxJC-EsVCXBj9Hg8drbSTks-FShKwWy0NBWPRBoNh0ieqspFPxz5endui8Oy5sVctxSLQGAroFi3UmAYVXSfhMhdsYFQEqmRSo+QqWldEFTuihNsaZCJWlssxaqzl+VuW8vxatbVL8EZjgNeRUQ4IQQGDmOSLZWQ+F027rRb4ap0ikg0Mq42HK5qeo1QnUWUNQZQCDRKWWkKyVa1hbwoZ4hMggnjXRd0FIIROtyXM9l7qM0LUKktbNgNc29gWcEnRhqUixWLeSstdJKxulorsc8houqpoua23KmaO14sTkDCqeacXYR7XGAt+hsGJDEBMZmfwFTjqepOw0g0oR1PmPOltqEPXtt+lbH1ZVkabqUfq-toKunKldKlAw6RdTaicNTIZRhJC4I0OST4uowTfHvW6x9r5o4Wzjq+xOe7cjErltY-cnxKamJpioFqSQ9zfGA2YJDH1sVodjhEb1a6+241-cGhUNYoO7H3OYVYUxNQAndMCSw-GmTrFulYGjQKo7FRjpbTtfLP4pzTjgbDwxBrO1EfKcEdNyYUk7i8OKTh5hqBrFMKYUn00yb5uhxjmHRZfrU2sYEsbVBgnWLSGm4JXQ-DZLMbULwUiWcXV9aTPLHM-uBUMX4xJK3uwmDWas+41a6lGWySt4ZWZ6gcVI8hcYV6Jlnth90ztfiWDCnqBWO4TyQYbWK5U8GoS33vo-DyL9sO7FGAYoxeRYRRT4fYXe2C9SwbYjlshFCqFFci0shAdaoOiLZKlG9nxy3CHMK6Sm8qJjpf1J6cbTioAaKUgomIrGouIGMCYP4UIENknBOTMxIyFDrBeOsmV4iWXdkkRNuM-j3HTfO7N4wmn8H6krXK95FaoRQeMUJl4NYFByDSc4IAA */
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
    depositTurboResult: null,
    depositGenerateAddressRef: null,
    tokenList: input.tokenList,
    userAddress: null,
    userChainType: null,
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
          userChainType: ({ event }) => event.params.userChainType,
        }),
      ],
    },

    LOGOUT: {
      actions: [
        "clearResults",
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
            guard: "isChainNearSelected",
            actions: "clearDepositResult",
          },
          {
            target: "submittingEVMTx",
            reenter: true,
            guard: "isChainEVMSelected",
          },
          {
            target: "submittingSolanaTx",
            reenter: true,
            guard: "isChainSolanaSelected",
          },
          {
            target: "submittingTurboTx",
            reenter: true,
            guard: "isChainAuroraEngineSelected",
          },
        ],

        INPUT: {
          target: ".pre-preparation",
          actions: [
            "clearError",
            "clearResults",
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

                        onError: {
                          target: "done",
                          actions: [
                            {
                              type: "logError",
                              params: ({ event }) => event,
                            },
                            {
                              type: "setError",
                              params: ({ event }) => {
                                console.log("onError type: setError", event)
                                return {
                                  reason: "ERR_GET_BALANCE",
                                  error: null,
                                }
                              },
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

                generating: {
                  initial: "idle",

                  states: {
                    idle: {
                      always: [
                        {
                          target: "execution_generating",
                          guard: "isPassiveDepositEnabledForSelectedChain",
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
                          assert(
                            context.userAddress != null,
                            "userAddress is null"
                          )
                          assert(
                            context.userChainType != null,
                            "userChainType is null"
                          )
                          assert(context.formValues.network, "network is null")

                          return {
                            userAddress: context.userAddress,
                            userChainType: context.userChainType,
                            chain: context.formValues.network,
                          }
                        },

                        onDone: {
                          target: "done",

                          actions: [
                            {
                              type: "setDepositGenerateAddressResult",
                              params: ({ event }) => {
                                return event.output
                              },
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
                      assert(context.userAddress, "userAddress is null")

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
          target: "editing.preparation",

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
            chainName: reverseAssetNetworkAdapter[context.formValues.network],
          }
        },

        onDone: {
          target: "editing.preparation",

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
          target: "editing.preparation",

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

    submittingTurboTx: {
      invoke: {
        id: "depositTurboRef",
        src: "depositTurboActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")

          assert(context.formValues.network, "network is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(context.formValues.token, "token is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
            depositAddress: settings.defuseContractId,
            chainName: reverseAssetNetworkAdapter[context.formValues.network],
          }
        },

        onDone: {
          target: "editing.preparation",

          actions: [
            {
              type: "setDepositTurboResult",
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
