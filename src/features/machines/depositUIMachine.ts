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
  type Events as DepositFormEvents,
  type ParentEvents as DepositFormParentEvents,
  depositFormReducer,
} from "./depositFormReducer"

import {
  type Output as DepositGenerateAddressMachineOutput,
  DepositGeneratedDescription,
  depositGenerateAddressMachine,
} from "./depositGenerateAddressMachine"
import { depositGenerateAddressMachineV2 } from "./depositGenerateAddressMachineV2"
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
import { prepareDepositActor } from "./prepareDepositActor"

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
  depositGenerateAddressV2Ref: ActorRefFrom<
    typeof depositGenerateAddressMachineV2
  >
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
  depositFormRef: ActorRefFrom<typeof depositFormReducer>
  fetchWalletAddressBalanceRef: ActorRefFrom<
    typeof backgroundBalanceActor
  > | null
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
        }
      | DepositFormEvents
      | DepositFormParentEvents,
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
    prepareDepositActor: prepareDepositActor,
    depositFormActor: depositFormReducer,
    depositGenerateAddressV2Actor: depositGenerateAddressMachineV2,
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

    relayToDepositFormRef: sendTo(
      "depositFormRef",
      (_, event: DepositFormEvents) => event
    ),

    requestGenerateAddressV2: sendTo(
      "depositGenerateAddressV2Ref",
      ({ context }) => {
        return {
          type: "REQUEST_GENERATE_ADDRESS",
          params: {
            userAddress: context.userAddress,
            blockchain: context.depositFormRef.getSnapshot().context.blockchain,
            userChainType: context.userChainType,
          },
        }
      }
    ),
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
    isDepositParamsComplete: and([
      "isTokenValid",
      "isNetworkValid",
      "isLoggedIn",
    ]),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgCcAJkYA6AGwBWEQGYAHLIDsC1esYKANCACewgIxjpU1Y1nSALAsZiR1kUYUBfV3pQdchEhUrkAKoAKkysSCDeXLz8Qgh40tJikrYi0iJKpunWYtZ6hvEmSqoyssVqTkpGSpnunmiYPkSSkLhYPFDEACIAogAK5ADK1MEA+gBi5ABKALKSAFRh-FHcfBFxeGIayUY2mQqy8mKH+caM2pKWJmXSFiKMRiJ1IF6N+M2tXB3d-UMjE9MZhNqD1SF1BqMAMIACQAgrRKD0uksIisYuthMdrEpLtolOIVKolAoSad4rcjDJGISXIkFCIys9XpxfC0IG1voNAgAhGYjFHsN6rWKIWTWWQpQ4KLbSTJGSpkhImSQiRQZGrS1TyJ4eF4NFkfdlfTpc3n8ozhQWcYUYhCyXaXPbOY6qSqyRXWTSSMViYmHO5KW6qJn6ppYNkck08vmhMSWyJC9GgOKyRgiSTExiVRy5X2KhTSSnWIyMOSqLFaz0hqKsz7tKNm0IKeNotbJxBOKQPB41NJpXIiRW5CViVTiERaqUT6zVt61o314h0PohAUJ61JwTCDQjjKe+nd1RGIe+yRGMfKfGWMxKbGzg3husdSSoABOYDwb7QAENX9-ojwxBrq2IrxAoOQyIo9hGKmfZiC4ZJjt6+7UrIJLVGhbi6syYYRsaL7vqgv7-qsxAQLwYCSLAOD-pROHvI+C7Pl+RF-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-MsoUipAkPW1MmoE9qvrEa7VDe5-TKvG85wKgSxSVuD8zEBYMzUhMKqCQ4hEqufcEAA */
  id: "deposit-ui",

  context: ({ input, spawn, self }) => ({
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
    depositFormRef: spawn("depositFormActor", {
      id: "depositFormRef",
      input: { parentRef: self },
    }),
    fetchWalletAddressBalanceRef: null,
    depositGenerateAddressV2Ref: spawn("depositGenerateAddressV2Actor", {
      id: "depositGenerateAddressV2Ref",
      input: { parentRef: self },
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
        "DEPOSIT_FORM.*": {
          target: "editing",
          actions: [
            {
              type: "relayToDepositFormRef",
              params: ({ event }) => event,
            },
          ],
        },

        DEPOSIT_FORM_FIELDS_CHANGED: ".reset_previous_preparation",

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

        reset_previous_preparation: {
          always: [
            {
              target: "preparation_v2",
              guard: "isDepositParamsComplete",
              actions: ["clearError", "clearResults", "clearBalances"],
            },
            {
              target: "idle",
            },
          ],
        },

        preparation_v2: {
          entry: ["requestGenerateAddressV2"],
          invoke: {
            src: "prepareDepositActor",
            input: ({ context }) => {
              return {
                formValues: context.depositFormRef.getSnapshot().context,
                depositGenerateAddressV2Ref:
                  context.depositGenerateAddressV2Ref,
              }
            },
            onDone: {
              target: "idle",
            },
            onError: {
              target: "idle",
              actions: {
                type: "logError",
                params: ({ event }) => event,
              },
            },
          },
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
