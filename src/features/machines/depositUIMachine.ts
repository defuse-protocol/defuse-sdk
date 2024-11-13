import { assetNetworkAdapter } from "src/utils/adapters"
import {
  type ActorRefFrom,
  assertEvent,
  assign,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import type { SwappableToken } from "../../types"
import { BlockchainEnum } from "../../types"
import { parseUnits } from "../../utils/parse"
import { isBaseToken } from "../../utils/token"
import { backgroundBalanceActor } from "./backgroundBalanceActor"
import {
  type Output as DepositGenerateAddressMachineOutput,
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
  rpcUrl: string | undefined
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
            network: BlockchainEnum
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
            rpcUrl: string | undefined
          }
        }
      | {
          type: "LOGOUT"
        },
    children: {} as {
      depositNearRef: "depositNearActor"
    },
  },
  actors: {
    formValidationBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
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
            network: BlockchainEnum
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
    setDepositGenerateAddressResult: assign({
      generatedAddressResult: (_, value: DepositGenerateAddressMachineOutput) =>
        value,
    }),
    clearDepositResult: assign({ depositNearResult: null }),

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
        { context, spawn, self },
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

    fetchPOABridgeInfo: sendTo("poaBridgeInfoRef", { type: "FETCH" }),
  },
  guards: {
    isDepositNearRelevant: ({ context }) => {
      return (
        context.balance + context.nativeBalance >=
        context.parsedFormValues.amount
      )
    },
    isBalanceSufficient: ({ event, context }) => {
      if (event.type === "SUBMIT") {
        return context.formValues.network === BlockchainEnum.NEAR
          ? context.balance > context.parsedFormValues.amount
          : true
      }
      return true
    },
    isDepositNonNearRelevant: ({ context }) => {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRIwB0ATjEAOAEwA2RtMYBGWQHZpAVmnSALABoQAT0R4ZGkUskqxSgMyqdSxo0kBfVwZQdchEhUrkAKoAKkysSCDeXLz8Qgh40rZK4hqykmKqsho6aUmyBsbxZhZWsjb2js5uHiBemD5EIpC4WDxQxADKgQBCALLUoSz8Udx8EXGytiVKStk2mRKSqgUmcqJqNjpiSduS2e6eaPX4jc1cbcR0AAohYcPHo7EmllO2GuqJSjrSStupK-E3qpxDNbLZvjMypYDrUjpxfE0IC02iIAG4AQwANlgIOjzu0ILwwCJWqj0ABrYl1eGnJH4tFYnF41pQBCk9AAY2ZvDCdwiIxi4xMkmUFlUGjs2kkSVs0kkALwSnUIlkXyV7w0jFl0hsMOpDSwiORUAZ2Nx+OIfPYD0FoDieC0YhEWx0WzB0nFs3yRmeIpVEvKc0YYneerhBpEsAIACMALa4C2EnjE9mUkT6nC0MDogBOACUwAAzK2RG1jO2IHR7ESqL45WsaKSSSb6H3xFTSESSHS2JaqN46RjfIdhqIIqNxhMs4hJlM8MlpjNZ3MF4tKcLWziPCKFBKqkSKTRWRxWDRggxxPZOlSNquqkOJaqHMeNGDJnPMi6zknzilU8M4JQYDvniYAAIIQBAOZwLAq4lgK5aCJWVYiGCziDtKSpDrYCqurIIiNiGGhnmUWQ6KOxwIm+YAfhaNE5ugOYiKgmJ4oWjGxumAFASBODgZB0GwLBRbwWWTwIK6kjiBkkgyL8JFpN6u62FkB6-KoDiaFWLwUTShoEKg5pgN0WLojwHJgMQAiwDgoEiOihZ8TmAAUijOAAlDOAEIgZRkmax5lgKJW62khCCqWI3xiD8WmDrIcgKkocioWIjAOBosnas4GjuDUPDoCg8ARBmvj3CFiH2pFOgWJFui2GlsjyJkCriqI8xbJFQ5LLKukRmcLJlS0oX2uk+G-N8PYNU1SkmKq+GOA4jVglkEhKL1JyGv1KI4piYCDdEFXCih411VNDUKloUntb2IbSlYa01CVtLGqaTL4vt24VvEOrVekHppGIZRvEkra7rMTq1pNqgZFk0NPrCL6GhO8Y4O9-JiUKEl2CILjODMMwPvYCpyMkh4ZWqp5gutVHATRn5QB9w2IDdKppXK8hpVIKgzfE7y-Wk0OpIDjDEdTjS+aB-lmRZjOHQg2idlkKmA8ODjQzzioel2qUOBkSr9tDuWuEAA */
  id: "deposit-ui",

  context: ({ input, spawn }) => ({
    error: null,
    balance: 0n,
    nativeBalance: 0n,
    formValues: {
      token: null,
      network: null,
      amount: "",
    },
    parsedFormValues: {
      amount: 0n,
    },
    depositNearResult: null,
    depositGenerateAddressRef: null,
    tokenList: input.tokenList,
    userAddress: "",
    defuseAssetId: null,
    tokenAddress: null,
    generatedAddressResult: null,
    poaBridgeInfoRef: spawn("poaBridgeInfoActor", {
      id: "poaBridgeInfoRef",
    }),
    rpcUrl: undefined,
  }),

  entry: ["fetchPOABridgeInfo"],

  on: {
    LOGIN: {
      actions: [
        assign({
          userAddress: ({ event }) => event.params.userAddress,
          rpcUrl: ({ event }) => event.params.rpcUrl,
        }),
      ],
    },

    LOGOUT: {
      actions: assign({
        userAddress: () => "",
      }),
    },
  },

  states: {
    editing: {
      on: {
        SUBMIT: {
          target: "submitting",
          guard: "isDepositNearRelevant",
          actions: "clearDepositResult",
        },

        INPUT: {
          target: ".validating",
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

        validating: {
          entry: "extractAssetIds",

          invoke: {
            src: "formValidationBalanceActor",

            input: ({ context }) => {
              return {
                defuseAssetId: context.defuseAssetId,
                tokenAddress: context.tokenAddress,
                userAddress: context.userAddress,
                network: context.formValues.network,
                rpcUrl: context.rpcUrl,
              }
            },

            onDone: [
              {
                target: "#deposit-ui.generating",

                actions: assign({
                  balance: ({ event }) => event.output.balance,
                  nativeBalance: ({ event }) => event.output.nativeBalance,
                }),

                reenter: true,
                guard: "isDepositNonNearRelevant",
              },
              {
                target: "idle",

                actions: assign({
                  balance: ({ event }) => event.output.balance,
                  nativeBalance: ({ event }) => event.output.nativeBalance,
                }),

                reenter: true,
              },
            ],
          },
        },
      },

      initial: "idle",
    },

    submitting: {
      invoke: {
        id: "depositNearRef",
        src: "depositNearActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")

          if (context.formValues.token == null || !context.userAddress) {
            throw new Error("Token or account ID is missing")
          }
          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
          }
        },

        onDone: [
          {
            target: "updateBalance",
            guard: { type: "isOk", params: ({ event }) => event.output },

            actions: [
              {
                type: "setDepositNearResult",
                params: ({ event }) => event.output,
              },
              { type: "clearUIDepositAmount" },
            ],

            reenter: true,
          },
          {
            target: "editing",

            actions: [
              {
                type: "setDepositNearResult",
                params: ({ event }) => event.output,
              },
              { type: "clearUIDepositAmount" },
            ],
          },
        ],
      },
    },

    generating: {
      invoke: {
        id: "depositGenerateAddressRef",
        src: "depositGenerateAddressActor",

        input: ({ context, event }) => {
          if (context.formValues.network == null || !context.userAddress) {
            throw new Error("Chain or account ID is missing")
          }
          return {
            accountId: context.userAddress,
            chain: context.formValues.network,
          }
        },

        onDone: {
          target: "editing",
          guard: { type: "isOk", params: ({ event }) => event.output },

          actions: [
            {
              type: "setDepositGenerateAddressResult",
              params: ({ event }) => event.output,
            },
          ],
        },

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },
    },

    // Delay the request by 2 seconds to ensure accurate balance retrieval due to NEAR RPC latency issues.
    updateBalance: {
      after: {
        "2000": {
          target: "editing.validating",
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
