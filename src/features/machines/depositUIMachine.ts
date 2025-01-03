import { settings } from "src/config/settings"
import { assert } from "src/utils/assert"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
} from "xstate"
import { logger } from "../../logger"
import type { ChainType } from "../../types/deposit"
import type { SwappableToken } from "../../types/swap"
import { isBaseToken, isNativeToken, isUnifiedToken } from "../../utils/token"
import {
  type Output as DepositEVMMachineOutput,
  depositEVMMachine,
} from "./depositEVMMachine"
import { depositEstimationMachine } from "./depositEstimationActor"
import {
  type Events as DepositFormEvents,
  type ParentEvents as DepositFormParentEvents,
  depositFormReducer,
} from "./depositFormReducer"
import { depositGenerateAddressMachine } from "./depositGenerateAddressMachine"
import {
  type Output as DepositNearMachineOutput,
  depositNearMachine,
} from "./depositNearMachine"
import {
  type Output as DepositSolanaMachineOutput,
  depositSolanaMachine,
} from "./depositSolanaMachine"
import { depositTokenBalanceMachine } from "./depositTokenBalanceMachine"
import {
  type Output as DepositTurboMachineOutput,
  depositTurboMachine,
} from "./depositTurboMachine"
import { poaBridgeInfoActor } from "./poaBridgeInfoActor"
import {
  type PreparationOutput,
  prepareDepositActor,
} from "./prepareDepositActor"
import { storageDepositAmountMachine } from "./storageDepositAmountMachine"

export type Context = {
  error: null | {
    tag: "err"
    value: {
      reason: "ERR_GET_BALANCE" | "ERR_GET_STORAGE_DEPOSIT_AMOUNT"
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
  depositGenerateAddressRef: ActorRefFrom<typeof depositGenerateAddressMachine>
  poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
  tokenList: SwappableToken[]
  userAddress: string | null
  userChainType: ChainType | null
  depositNearResult: DepositNearMachineOutput | null
  depositEVMResult: DepositEVMMachineOutput | null
  depositSolanaResult: DepositSolanaMachineOutput | null
  depositTurboResult: DepositTurboMachineOutput | null
  depositFormRef: ActorRefFrom<typeof depositFormReducer>
  preparationOutput: PreparationOutput | null
  storageDepositAmountRef: ActorRefFrom<typeof storageDepositAmountMachine>
  depositTokenBalanceRef: ActorRefFrom<typeof depositTokenBalanceMachine>
  depositEstimationRef: ActorRefFrom<typeof depositEstimationMachine>
}

export const depositUIMachine = setup({
  types: {
    input: {} as {
      tokenList: SwappableToken[]
    },
    context: {} as Context,
    events: {} as
      | {
          type: "SUBMIT"
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
    depositNearActor: depositNearMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
    depositEVMActor: depositEVMMachine,
    depositSolanaActor: depositSolanaMachine,
    depositTurboActor: depositTurboMachine,
    prepareDepositActor: prepareDepositActor,
    depositFormActor: depositFormReducer,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    storageDepositAmountActor: storageDepositAmountMachine,
    depositTokenBalanceActor: depositTokenBalanceMachine,
    depositEstimationActor: depositEstimationMachine,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>["value"]) => ({
        tag: "err" as const,
        value: error,
      }),
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
    setPreparationOutput: assign({
      preparationOutput: (_, val: Context["preparationOutput"]) => val,
    }),
    clearDepositResult: assign({ depositNearResult: null }),
    clearDepositEVMResult: assign({ depositEVMResult: null }),
    clearDepositSolanaResult: assign({ depositSolanaResult: null }),
    clearDepositTurboResult: assign({ depositTurboResult: null }),
    clearResults: assign({
      depositNearResult: null,
      depositEVMResult: null,
      depositSolanaResult: null,
      depositTurboResult: null,
    }),

    clearUIDepositAmount: () => {
      throw new Error("not implemented")
    },
    clearBalances: assign({
      balance: 0n,
      nativeBalance: 0n,
    }),

    clearPreparationOutput: assign({
      preparationOutput: null,
    }),

    fetchPOABridgeInfo: sendTo("poaBridgeInfoRef", { type: "FETCH" }),

    relayToDepositFormRef: sendTo(
      "depositFormRef",
      (_, event: DepositFormEvents) => event
    ),

    requestGenerateAddress: sendTo(
      "depositGenerateAddressRef",
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
    requestStorageDepositAmount: sendTo(
      "storageDepositAmountRef",
      ({ context }) => {
        return {
          type: "REQUEST_STORAGE_DEPOSIT",
          params: {
            token: context.depositFormRef.getSnapshot().context.token,
            userAccountId: context.userAddress,
          },
        }
      }
    ),
    requestBalanceRefresh: sendTo("depositTokenBalanceRef", ({ context }) => {
      return {
        type: "REQUEST_BALANCE_REFRESH",
        params: {
          token: context.depositFormRef.getSnapshot().context.derivedToken,
          userAddress: context.userAddress,
          blockchain: context.depositFormRef.getSnapshot().context.blockchain,
        },
      }
    }),
  },
  guards: {
    isTokenValid: ({ context }) => {
      return !!context.depositFormRef.getSnapshot().context.token
    },
    isNetworkValid: ({ context }) => {
      return !!context.depositFormRef.getSnapshot().context.blockchain
    },
    isLoggedIn: ({ context }) => {
      return !!context.userAddress
    },
    isChainNearSelected: ({ context }) => {
      return context.depositFormRef.getSnapshot().context.blockchain === "near"
    },
    isChainEVMSelected: ({ context }) => {
      const blockchain = context.depositFormRef.getSnapshot().context.blockchain
      return (
        blockchain === "eth" ||
        blockchain === "base" ||
        blockchain === "arbitrum"
      )
    },
    isChainSolanaSelected: ({ context }) => {
      return (
        context.depositFormRef.getSnapshot().context.blockchain === "solana"
      )
    },
    isChainAuroraEngineSelected: ({ context }) => {
      const blockchain = context.depositFormRef.getSnapshot().context.blockchain
      return blockchain === "turbochain" || blockchain === "aurora"
    },
    isBalanceSufficientForEstimate: ({ context }) => {
      const token = context.depositFormRef.getSnapshot().context.token
      if (token == null) {
        return false
      }
      // For all Native tokens, we should validate wallet native balance
      if (
        (isUnifiedToken(token) && token.groupedTokens.some(isNativeToken)) ||
        (isBaseToken(token) && isNativeToken(token))
      ) {
        return context.nativeBalance > 0n
      }
      return context.balance > 0n
    },
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
    isDepositParamsComplete: and([
      "isTokenValid",
      "isNetworkValid",
      "isLoggedIn",
    ]),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZGADgB0YgKyiALHLFzpAZnEA2aQBoQAT0R51jYRPUAmMwHZGcyyuHqjlgL7OdKDrkIkKlcgFUAFSZWJBBPLl5+IQQVCwlpaTFLaUtbSzNxOR19BEMzSVSkuWElYQBOcvVy13c0TC8iCUhcLB4oYgARAFEABXIAZWpAgH0AMXIAJQBZCQAqEP4I7j4wmOEHCTizdRU5culqhWFLHIM4lSlys1KHOTNVFNqQDwb8Jpaudq6+weHxqbTcbUbqkToDEYAYQAEgBBWiUbqdRZhZZRNYiSwSKqMcq49SWSzXFQHM55DZY3YKC64yxKMTCZ6vTjeZoQVrfAb+ABC02GKPYbxW0UQ1kuGzEmWk5UsVI2ZNS2OS6gZcnMYhUYnUjLcL3qLI+7K+HS5vP5wlCgs4woxCBVWIU5ms10JmrJmXKCU0ckYdjpSksJyZ+saWDZHJNPL5wTMlvCQvRoBiKpMNwqGxO8l9ZJUJNMFWMD0zjmkcmDEVZnzakbNwRUcbRqyTiEcJhJDjEBwOYh7wjJtnUEkUaROWXxD3Lb0rRurEgATnAwDgRqgFwA3bgEWArheoACGc73kR4xAF8eticEiEUWwHOysZiq9myehENiHao1wiKGcqk4NYZVu086Lsuq5gBu6BbjuaAHkeKynhaSwJk2V6xD6Eg3JUwgqES1z7C+uTfnIWyyqWSSMLiOF2P+obhsaEjgfuh7HsQEC8GAEhtGu6AANaccydFAVAjG7nBx4INx6AAMbwbwIRno2IqxDImElI4PZYTIKg5qIEiBjsyQOCSuLSLR7yATOwFMeJCFgHOc7oHOjEADZHgAZk5AC2EiCRZ9GzjZLErJJPA8bJx4KSwyEXqhMSatI2L4rIZi4XYJQ5uUJE+ikcTVOUwjqWZup+aysAEAARl5uDGrQYAHoEAhsRxXFhXxAkhjgdUHpMYDuYpKHKYVaQJNY2r3OoaqFTpr4ILIpglKlBblGINidmWJWdWVlXVTgxrdAAatMjXNTwnFSfxvmdYd0y9f10WooNtrDSRqSMONOxTXIM1EdKEimeYDiJAoaRmOZ21VTV1YDOgbk8HuJ3sWdrU8Zdfkw3De53QNsVDbYjDYrKMhpCq0oPO6koSJmZj3EkgO7ODTTlZDe3VoEBBzhV6CIy1F0dRE7Oc+g2MPVarSXustiXFqKiJDKOFxH2s3fVixgEg4QNpYwKiuLqPDoCg8BhKVRAxeLcUGESCRWLhuzCDsGRamSeDKJIJI3DIuxUROm0VoaEZm8eyl4PY1t+nbDsFKkztSlTezfTTGr7Dc6iM5ZEZcRALlgIHNrNggyiepKuH299BJaoR16DnS0gFIwdO4rYYO+1O-sMQusBLjBkHQUFcmoUptq2NilQypN0i+vYzu11sqXat+KqalqhVpwF1licFl6D-nmxN+YKj2nEgbfTm72kSUCgMtq4i+qvzO7bV9Vzo1ucS2+Gr6e9lGJJk4ilAq0tkg+nuIGFMLgW4AQkPfKG7Qbov0erjZ6WQpAT1LD6bWhUySZiHOtSU5RNR4jUMVOofswzQNZu0DGe54bwLFkHJBgZ9Ipz2D2GU+x1Duiyl6WQ2stRVAyHfHaMCoCCy5rQ885shq+kkKUSaGQ67vQyP2XC-1xCyAmqWYwYhdbOCAA */
  id: "deposit-ui",

  context: ({ input, spawn, self }) => ({
    error: null,
    balance: 0n,
    nativeBalance: 0n,
    maxDepositValue: 0n,
    depositNearResult: null,
    depositEVMResult: null,
    depositSolanaResult: null,
    depositTurboResult: null,
    tokenList: input.tokenList,
    userAddress: null,
    userChainType: null,
    tokenAddress: null,
    preparationOutput: null,
    fetchWalletAddressBalanceRef: null,
    poaBridgeInfoRef: spawn("poaBridgeInfoActor", {
      id: "poaBridgeInfoRef",
    }),
    depositFormRef: spawn("depositFormActor", {
      id: "depositFormRef",
      input: { parentRef: self },
    }),
    depositGenerateAddressRef: spawn("depositGenerateAddressActor", {
      id: "depositGenerateAddressRef",
      input: { parentRef: self },
    }),
    storageDepositAmountRef: spawn("storageDepositAmountActor", {
      id: "storageDepositAmountRef",
      input: { parentRef: self },
    }),
    depositTokenBalanceRef: spawn("depositTokenBalanceActor", {
      id: "depositTokenBalanceRef",
      input: { parentRef: self },
    }),
    depositEstimationRef: spawn("depositEstimationActor", {
      id: "depositEstimationRef",
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
      },

      states: {
        idle: {},

        reset_previous_preparation: {
          always: [
            {
              target: "preparation",
              guard: "isDepositParamsComplete",
              actions: ["clearError", "clearResults", "clearBalances"],
            },
            {
              target: "idle",
            },
          ],
          entry: ["clearPreparationOutput"],
        },

        preparation: {
          entry: [
            "requestGenerateAddress",
            "requestStorageDepositAmount",
            "requestBalanceRefresh",
          ],
          invoke: {
            src: "prepareDepositActor",

            input: ({ context }) => {
              assert(context.userAddress, "userAddress is null")
              return {
                userAddress: context.userAddress,
                formValues: context.depositFormRef.getSnapshot().context,
                depositGenerateAddressRef: context.depositGenerateAddressRef,
                storageDepositAmountRef: context.storageDepositAmountRef,
                depositTokenBalanceRef: context.depositTokenBalanceRef,
                depositEstimationRef: context.depositEstimationRef,
              }
            },

            onError: {
              target: "idle",
              actions: {
                type: "logError",
                params: ({ event }) => event,
              },
              reenter: true,
            },

            onDone: {
              target: "idle",
              actions: {
                type: "setPreparationOutput",
                params: ({ event }) => event.output,
              },
              reenter: true,
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
          const token = context.depositFormRef.getSnapshot().context.token
          const parsedAmount =
            context.depositFormRef.getSnapshot().context.parsedAmount
          const storageDepositRequired =
            context.preparationOutput?.tag === "ok"
              ? context.preparationOutput.value.storageDepositRequired
              : null

          assert(token, "token is null")
          assert(context.userAddress, "userAddress is null")
          assert(
            storageDepositRequired !== null,
            "storageDepositRequired is null"
          )
          assert(parsedAmount, "parsed amount is null")
          return {
            balance: context.balance,
            amount: parsedAmount,
            asset: token,
            accountId: context.userAddress,
            storageDepositRequired,
          }
        },
        onDone: {
          target: "editing.reset_previous_preparation",
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
            context.preparationOutput?.tag === "ok"
              ? context.preparationOutput.value.generateDepositAddress
              : null
          const token = context.depositFormRef.getSnapshot().context.token
          const blockchain =
            context.depositFormRef.getSnapshot().context.blockchain
          const parsedAmount =
            context.depositFormRef.getSnapshot().context.parsedAmount
          assert(token && isBaseToken(token), "token is not prepared")
          assert(blockchain !== null, "blockchain is null")
          assert(context.userAddress, "userAddress is null")
          assert(depositAddress, "depositAddress is null")
          assert(parsedAmount, "parsed amount is null")
          return {
            balance: context.balance,
            amount: parsedAmount,
            asset: token,
            accountId: context.userAddress,
            tokenAddress: token.address,
            depositAddress,
            chainName: blockchain,
          }
        },
        onDone: {
          target: "editing.reset_previous_preparation",
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
            context.preparationOutput?.tag === "ok"
              ? context.preparationOutput.value.generateDepositAddress
              : null
          const token = context.depositFormRef.getSnapshot().context.token
          const blockchain =
            context.depositFormRef.getSnapshot().context.blockchain
          const parsedAmount =
            context.depositFormRef.getSnapshot().context.parsedAmount
          assert(token && isBaseToken(token), "token is not prepared")
          assert(blockchain !== null, "blockchain is null")
          assert(context.userAddress, "userAddress is null")
          assert(depositAddress, "depositAddress is null")
          assert(parsedAmount, "parsed amount is null")
          return {
            balance: context.balance,
            amount: parsedAmount,
            asset: token,
            accountId: context.userAddress,
            tokenAddress: token.address,
            depositAddress,
            chainName: blockchain,
          }
        },
        onDone: {
          target: "editing.reset_previous_preparation",
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
          const token = context.depositFormRef.getSnapshot().context.token
          const blockchain =
            context.depositFormRef.getSnapshot().context.blockchain
          const parsedAmount =
            context.depositFormRef.getSnapshot().context.parsedAmount
          assert(token && isBaseToken(token), "token is not prepared")
          assert(blockchain !== null, "blockchain is null")
          assert(context.userAddress, "userAddress is null")
          assert(parsedAmount, "parsed amount is null")
          return {
            balance: context.balance,
            amount: parsedAmount,
            asset: token,
            accountId: context.userAddress,
            tokenAddress: token.address,
            depositAddress: settings.defuseContractId,
            chainName: blockchain,
          }
        },
        onDone: {
          target: "editing.reset_previous_preparation",
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
