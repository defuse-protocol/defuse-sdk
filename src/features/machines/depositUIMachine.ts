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
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "../../types/base"
import type { ChainType } from "../../types/deposit"
import type { SwappableToken } from "../../types/swap"
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

    clearError: assign({ error: null }),
    clearResults: assign({
      depositNearResult: null,
      depositEVMResult: null,
      depositSolanaResult: null,
      depositTurboResult: null,
    }),
    clearUIDepositAmount: () => {
      throw new Error("not implemented")
    },
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
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
    isDepositParamsComplete: and([
      "isTokenValid",
      "isNetworkValid",
      "isLoggedIn",
    ]),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZGADgB0YgKyiALHLFzpAZnEA2aQBoQAT0R51jYRPUAmMwHZGcyyuHqjlgL7OdKDrkIkKlcgFUAFSZWJBBPLl5+IQQVCwlpaTFLaUtbSzNxOR19BEMzSVSkuWElYQBOcvVy13c0TC8iCUhcLB4oYgARAFEABXIAZWpAgH0AMXIAJQBZCQAqEP4I7j4wmOEHCTizdRU5culqhWFLHIM4lSlys1KHOTNVFNqQDwb8Jpaudq6+weHxqbTcbUbqkToDEYAYQAEgBBWiUbqdRZhZZRNYiSwSKqMcq49SWSzXFQHM55DZY3YKC64yxKMTCZ6vTjeZoQVrfAb+ABC02GKPYbxW0UQ1kuGzEmWk5UsVI2ZNS2OS6gZcnMYhUYnUjLcL3qLI+7K+HS5vP5wlCgs4woxCBVWIU5ms10JmrJmXKCU0ckYdjpSksJyZ+saWDZHJNPL5wTMlvCQvRoBiKpMNwqGxO8l9ZJUJNMFWMD0zjmkcmDEVZnzakbNwRUcbRqyTiEcJhJDjEBwOYh7wjJtnUEkUaROWXxD3Lb0rRurEgATnAwDgRqgFwA3bgEWArheoACGc73kR4xAF8eticEiEUWwHOysZiq9myehENiHao1wiKGcqk4NYZVu086Lsuq5gBu6BbjuaAHkeKynhaSwJk2V6xD6Eg3JUwgqES1z7C+uTfnIWyyqWSSMLiOF2P+obhsaEjgfuh7HsQEC8GAEhtGu6AANaccydFAVAjG7nBx4INx6AAMbwbwIRno2IqxDImElI4PZYTIKg5qIEiBjsyQOCSuLSLR7yATOwFMeJCFgHOc7oHOjEADZHgAZk5AC2EiCRZ9GzjZLErJJPA8bJx4KSwyEXqhMSatI2L4rIZi4XYJQ5uUJE+ikcTVOUwjqWZup+aysAEAARl5uDGrQYAHoEAhsRxXFhXxAkhjgdUHpMYDuYpKHKYVaQJNY2r3OoaqFTpr4ILIpglKlBblGINidmWJWdWVlXVTgxrdAAatMjXNTwnFSfxvmdYd0y9f10WooNtrDSRqSMONOxTXIM1EdKEimeYDiJAoaRmOZ21VTV1YDOgbk8HuJ3sWdrU8Zdfkw3De53QNsVDbYjDYrKMhpCq0oPO6koSJmZj3EkgO7ODTTlZDe3VoEBBzhV6CIy1F0dRE7Oc+g2MPVarSXustiXFqKiJDKOFxH2s3fVixgEg4QNpYwKiuLqPDoCg8BhKVRAxeLcUGESCRWLhuzCDsGRamSeDKJIJIWJkKsKMo6iM5ZEZm8eyl4PY1t+nbDsFKkztSlTewkioKqdniLibRWhoRlxEAuWAgc2s2CDKJ6kqJ7Kk1VDcpyzSqUg2BsJTfmkDLFXU6f+wxC6wEuMGQdBQVyahSm2rY2KVDKk3SL69jO9IZhbKl2rfiqmpaoVfsBdZYnBZeQ8F5stj3onyRxIG305u9pElAoDLauIvrr8zu21fVc6NXnEtvhq+nvZRiSZOIpQFTS2SD6e4gYUyp1blOJmO0obtBum-R6uNnpZCkJPUsPptaFTJJmIc61JTlE1HiNQLc9RtwkI-OBUAMZ7nhogsWQcUGBn0jcKkPYZT7HUO6LKXpZDay1FUDID9YGs3aILLm9DzzmyGr6SQpRJoZAKJRAkZh+y4X+uIWQE1SzGDELrZwQA */
  id: "deposit-ui",

  context: ({ input, spawn, self }) => ({
    error: null,
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
            actions: "clearResults",
            reenter: true,
          },
          {
            target: "submittingEVMTx",
            guard: "isChainEVMSelected",
            actions: "clearResults",
            reenter: true,
          },
          {
            target: "submittingSolanaTx",
            guard: "isChainSolanaSelected",
            actions: "clearResults",
            reenter: true,
          },
          {
            target: "submittingTurboTx",
            guard: "isChainAuroraEngineSelected",
            actions: "clearResults",
            reenter: true,
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
              actions: ["clearError", "clearResults"],
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
        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")
          const params = extractDepositParams(context)
          assert(
            params.storageDepositRequired !== null,
            "storageDepositRequired is null"
          )
          return {
            ...params,
            storageDepositRequired: params.storageDepositRequired,
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
          const params = extractDepositParams(context)
          assert(params.depositAddress, "depositAddress is null")
          return {
            ...params,
            depositAddress: params.depositAddress,
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
          const params = extractDepositParams(context)
          assert(params.depositAddress, "depositAddress is null")
          return {
            ...params,
            depositAddress: params.depositAddress,
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
          const params = extractDepositParams(context)
          return {
            ...params,
            depositAddress: settings.defuseContractId,
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

type DepositParams = {
  token: BaseTokenInfo | UnifiedTokenInfo
  balance: bigint
  nativeBalance: bigint
  amount: bigint
  userAddress: string
  tokenAddress: string
  depositAddress: string | null
  chainName: SupportedChainName
  storageDepositRequired: bigint | null
}

function extractDepositParams(context: Context): DepositParams {
  const { value: prepOutput } =
    context.preparationOutput?.tag === "ok"
      ? context.preparationOutput
      : { value: null }

  const { token, derivedToken, blockchain, parsedAmount } =
    context.depositFormRef.getSnapshot().context

  // Validate all required fields
  assert(token, "token is null")
  assert(derivedToken, "derivedToken is null")
  assert(blockchain !== null, "blockchain is null")
  assert(context.userAddress, "userAddress is null")
  assert(parsedAmount, "parsed amount is null")
  assert(prepOutput?.balance, "balance is null")
  assert(prepOutput?.nativeBalance, "nativeBalance is null")

  return {
    token,
    balance: prepOutput.balance,
    nativeBalance: prepOutput.nativeBalance,
    amount: parsedAmount,
    userAddress: context.userAddress,
    tokenAddress: derivedToken.address,
    depositAddress: prepOutput.generateDepositAddress,
    chainName: blockchain,
    storageDepositRequired: prepOutput.storageDepositRequired,
  }
}
