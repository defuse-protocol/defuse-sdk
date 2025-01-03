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
import { depositGenerateAddressMachine } from "./depositGenerateAddressMachine"
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
  fetchWalletAddressBalanceRef: ActorRefFrom<
    typeof backgroundBalanceActor
  > | null
  preparationOutput: PreparationOutput | null
  storageDepositAmountRef: ActorRefFrom<typeof storageDepositAmountMachine>
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
    fetchWalletAddressBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
    depositEVMActor: depositEVMMachine,
    depositSolanaActor: depositSolanaMachine,
    depositEstimateMaxValueActor: depositEstimateMaxValueActor,
    depositTurboActor: depositTurboMachine,
    prepareDepositActor: prepareDepositActor,
    depositFormActor: depositFormReducer,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    storageDepositAmountActor: storageDepositAmountMachine,
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZGADgB0YgKyiALHLFzpAZnEA2aQBoQAT0R51jYRPUAmMwHZGcyyuHqjlgL7OdKDrkIkKlcgFUAFSZWJBBPLl5+IQQVCwlpaTFLaUtbSzNxOR19BEMzSVSkuWElYQBOcvVy13c0TC8iCUhcLB4oYgARAFEABXIAZWpAgH0AMXIAJQBZCQAqEP4I7j4wmOEHCTizdRU5culqhWFLHIM4lSlys1KHOTNVFNqQDwb8Jpaudq6+weHxqbTcbUbqkToDEYAYQAEgBBWiUbqdRZhZZRNYiSwSKqMcq49SWSzXFQHM55DZY3YKC64yxKMTCZ6vTjeZoQVrfAb+ABC02GKPYbxW0UQ6jEl3K1mECkYuIOMjJVi2MkStwOiiJ0iZ9RZH3ZXw6XN5-OEoUFnGFGIQjkkZnKYkyYiqwhUiW0ekxkiqcUJdjddjk2oirM+bUNPL5wTMZvCQvRoBijjMEkYuyU1xsmgZZLU5RTDjEDuSKmSBMDbheOsaWDZHPDxuCKhjaNWCdF9wkZjkKnMlnMB0YhzJCmkUhkBTScnEqeUQbeIf1YYkACc4GAcCNUKuAG7cAiwTer1AAQ2Xx8iPGIAtjFvjgkQii2tnUd3M0gOBUV6gkJXMonFsrlKIpRzrqNahu0K5rhuW5gLu6D7oeaCnueKxXqaSxxq296xJUKYEqkjBEicYiDmSGy2mYcTlPcyQWGojIVsy1a1gaEiwSeZ4XiM25mMQEC8GAEhtNu6AANZCcx7zgYukEcSh3G8QgInoAAxqhvAhNeLYirEL6mKohkpIOsgOORVSdgokpURUSaFqBLEQVA7FHgpKw8XxYDLsu6DLuxAA254AGa+QAthIUkLnWLnIVx7lKSp6kXlpLCYbe2ExD2yZxMIsjqN29qWBUiopNiaiaNIRE9qIXYOdJEiwAQABGoW4AatBgKegQCPxgnCTwokSRFVY4B1p6TGAQXaVhunSokP4WIkFj2jZpweggohXC6k4yKI1xVHVrKNS1bVht0ABq0zdb1PBCSpQ1SRd0wTVNqWojNVpzaO9wPNIy0OvYa25MIBQ-uUewZiDuV9mYh1NMdrU4AaAzoIFPDHtdAm3f1g2SSNKNo8eL3Tels3KCYRaapVFjCIqsgJNUGx2vc1yaHDNYI6d7SBAQy5NegmN9fdeMRDzfPoMTb3mq0d7rMocgSEV0j7IScjVCW2TrVO34lMoYiaBY4gZCorgVjw6AoPAYSRUQaUyxlBh0imJK4ow2xEUY7q5HgetbNcDiDridq7OzrFhnbF66XgajO3ieLu32ZHrXgmSji6Ci-r93Z9qHTnCRA-lgBHlptgg3bflRiTeiD3aVeoOaFC+FE1cHs5MSNUVsausDrkh8GIfJcV3jpVq2NilSSvllV2LTyd-VsVFN4c4qFi+5Z1MGerRYPGk8B5xey4gOxbHEspOvluIZ4quUSBUDpAcrRUyIwsPt5vHPNYj7Wdcu3UHw7G0ZwJFSDRV0qhqjg0VJcAof00jmHFEBJ0odOZIzOpdP+71SafVTKOawXYHRuwImkciU4xx+moocF0DxkGfy5lAAmx50YYOlpHbB89UiugyMSHsQMj67GxP2NIFg0wWBoSdVB3Neb82YTee2s1Bx5jdmUN2LoxRq2HKmH8qYNbmBuCDU2zggA */
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
          entry: ["requestGenerateAddress", "requestStorageDepositAmount"],
          invoke: {
            src: "prepareDepositActor",

            input: ({ context }) => {
              return {
                formValues: context.depositFormRef.getSnapshot().context,
                depositGenerateAddressRef: context.depositGenerateAddressRef,
                storageDepositAmountRef: context.storageDepositAmountRef,
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
