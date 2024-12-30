import { settings } from "src/config/settings"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
} from "xstate"
import type { BaseTokenInfo, ChainType, SwappableToken } from "../../types"
import type { BlockchainEnum } from "../../types"
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
import {
  type PreparationOutput,
  prepareDepositActor,
} from "./prepareDepositActor"

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
  preparationOutput: PreparationOutput | null
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
    setPreparationOutput: assign({
      preparationOutput: (_, val: Context["preparationOutput"]) => val,
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
      return !!context.depositFormRef.getSnapshot().context.tokenIn
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
      const token = context.depositFormRef.getSnapshot().context.tokenIn
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
    isPassiveDepositEnabledForSelectedChain: ({ context }) => {
      const blockchain = context.depositFormRef.getSnapshot().context.blockchain
      return (
        blockchain != null &&
        blockchain !== "near" &&
        blockchain !== "turbochain" &&
        blockchain !== "aurora" &&
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgBMARhGMAdIwDsYgMwBOACwA2RgA4FAVhUAaEAE9hYs0qkaxmsSqVqFi2QoC+Lwyg65CJCpXIAqgAqTKxIIF5cvPxCCHjWmrJSIiI6aipmjkp6OoYmcWbqUjp69jqaaTryOm4eaJjeRFKQuFg8UMQAIgCiAArkAMrUQQD6AGLkAEoAslIAVKH8kdx84bGiCrLSaYwistqMuioGxsLaSUrZImqaGmqKjCq1IJ4N+E0tXO1dfYPD41NpuNqN1SJ0BiMAMIACQAgrRKN1OotwstomthKkVElnLd9rI1DolJpdnlhGoRApiilNCS0go1Gp5M9XpwfM0IK1vgMAgAhabDFHsN4rGKYxhyGQqBQqRjEpSSbGyMlxY4WYkU67pcRyWQs+psj6cr4dHn8wViMLCziijFxSQMqTShSaFSUsSMy4iFV4RwqYq6OQKF2HGUlfWRdmfNqmvkCkIiK0REXo0DrRUiSw3SnqRwE4k+sTEp27TTZRjpMS7GruF4GxpYDlc2PmkIKJNo1Zp8UUp20vTqR5VBQ+zSZvZiHS6BnYlQ6EQRt5R40xqQAJzgYBwI1QG4AbtwCLAdxvUABDNdnqI8YhC5M21OCTEZKkuhUVsRbS4j06qyRSRIHBEYlFB0R4xEXQ1G2jdp103bddzAA90CPE80AvK8VlvS0lhTLsn3tDRpGJKpXX2IsKx9N1-TdQ5KXuTZXXDWtWQbJsTSkRDz0va8Rj3ERiAgXgwCkNo93QABrETWPeaCV1griMN4-iEDE9AAGNMN4UI707MV7VlKlgKUXQKj2dIGR9LYAJlWUiynWQMkgtiYKgTjTyUlY+IEsA1zXdA104gAbK8ADMAoAWykGTl2bdz0J4ryVLUzTrx0lhcIffD01lTMHCcLQqlkAkVWkRRKXI4ldBEFRtFpZzZKkWACAAIwi3ATVoMALyCARBOE0SeHEqTovrHAuovSYwFC3S8P0+IaqSEQSRq4MTLAz8qOcKRlCsdQdEUWqlAa9lmrajqY26AA1aZev6ngRLUkaZOu6YppmjLUTmu0FuxZIVuddbdjEH1bJkJQtnnJQJVdFITqaM72pwE0BnQEKeDPO6hIewbhuksbUfRs93tmrL5okMCAOcEz7n2SQbh9cQ1AAstlplOUJGAzR4cbRGLvaIICDXFr0CxganvxyJBeF9ASc+61WkfdYJD+4lZEkRIMmWkpRx0ZIp1qz9DaUCRjueHh0BQeBwhiohMsV7LMVkaGAJq2rKmsRzcl-PAIczOx5xlRyXXsnn2Jje3r3mvY3Vd44KkJT25ysswZBpdb5D2VwWLG2KOKwCAgrASPbW7QjVDj93E81738jwCkqXnZa6QcRlmRzyMjTijdYC3NDkNQxTEsfPSfpqxQpGcG43XkEzGFr4QHJkBwbBdce5QXDuly7jih60nhvJLpXn10Es7DkMCthlH86-EJIwMuWjA2ydQw755GYwmtdeqPx2CkJZmNxnBTnnBkKoC9VSUwfkyCkVYFTYjfq1JGJpXo-y+mTH6HoSjFDdDYN0GpqygwUHlaUCp9hMiqLsNQiDzof3aITM8GM0EKyjpgxkmhLDyEctDa4ztKI+0kHraU9xyibHKAdeeNDkExmliLZh94Hbk0ZOOCstIaraHwWoKyVISSHCZM4XY6tKRuDcEAA */
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
    preparationOutput: null,
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
              actions: {
                type: "setPreparationOutput",
                params: ({ event }) => event.output,
              },
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
          const tokenIn = context.depositFormRef.getSnapshot().context.tokenIn
          assert(tokenIn, "token is null")
          assert(context.userAddress, "userAddress is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: tokenIn,
            accountId: context.userAddress,
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
            context.generatedAddressResult?.tag === "ok"
              ? context.generatedAddressResult.value.depositAddress
              : null
          const tokenIn = context.depositFormRef.getSnapshot().context.tokenIn
          const blockchain =
            context.depositFormRef.getSnapshot().context.blockchain

          assert(tokenIn, "token is null")
          assert(blockchain !== null, "blockchain is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(depositAddress, "depositAddress is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: tokenIn,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
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
            context.generatedAddressResult?.tag === "ok"
              ? context.generatedAddressResult.value.depositAddress
              : null
          const tokenIn = context.depositFormRef.getSnapshot().context.tokenIn
          const blockchain =
            context.depositFormRef.getSnapshot().context.blockchain

          assert(tokenIn, "token is null")
          assert(blockchain !== null, "blockchain is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(depositAddress, "depositAddress is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: tokenIn,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
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
          const tokenIn = context.depositFormRef.getSnapshot().context.tokenIn
          const blockchain =
            context.depositFormRef.getSnapshot().context.blockchain

          assert(tokenIn, "token is null")
          assert(blockchain !== null, "blockchain is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: tokenIn,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
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

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
