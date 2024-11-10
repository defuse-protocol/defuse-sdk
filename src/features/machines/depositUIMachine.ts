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
  tokenList: SwappableToken[]
  userAddress: string
  defuseAssetId: string | null
  generatedAddressResult: DepositGenerateAddressMachineOutput | null
  depositNearResult: DepositNearMachineOutput | null
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

    extractDefuseAssetId: assign({
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRIwB0ATjEAOAEwA2RtMYBGWQHZpAVmnSALABoQAT0R4ZGkUskqxSgMyqdSxo0kBfVwZQdchEhUrkAKoAKkysSCDeXLz8Qgh40rZK4hqykmKqsho6aUmyBsbxZhZWsjb2js5uHiBemD5EIpC4WDxQxADKgQBCALLUoSz8Udx8EXGytiVKStk2mRKSqgUmcqJqNjpiSduS2e6eaPX4jc1cbcR0AAohYcPHo7EmllO2GuqJSjrSStupK-E3qpxDNbLZvjMypYDrUjpxfE0IC02iIAG4AQwANlgIOjzu0ILwwCJWqj0ABrYl1eGnJH4tFYnF41pQBCk9AAY2ZvDCdwiIxi4xMsh0OhEOg0S2yYLUshUALwWmBjgcOwyWVUShh1IaWERyKgDOxuPxxEJPGJ7MpIh1Jz1ZxZRqZ+LZPDJXOiPF5SnC7AegtAcVMXxEaSUiW+MlUGnBCp09hE0jEGi+YkUQNUb21cN1IlgBAARgBbXCm82Wt0Uqk5nC0MDogBOACUwAAzPl+ziPIUIHR7ESa0VqWZSSSTfRGZ6yaQiSTxpaZ7KMb7L7NRBH54ullnEMANhvoBsiVCYvGtw9Fm01uuNlvtob8-1jQOIPvAmzyRhiFUyOX5SfxBo5g2JISQ5BIOTfKoa7HAiMAWg2zIXOWJKVtatqUGACF4mAACCEAQA2cCwHeHaRE+Ty9n2Ihgs4OguEkqjLrYcY5CIGgSEBMZlFkOgwTSerwXuSHtHuB5HieZ4XleUSYdhOB4QRRGwCRbZkQKz6CK+1ESKokgyL83FpP+hR4LYWSJr8qgOJofYvPxuYEKgJpgN0WLojwHJgMQAiwDgOEiOirYKQ2AAUijOAAlGaNYIk5LluaenlgOpFE9hZ35Jj8tn0dOJnPHINFiIwDiSqB2jOBo7g1Dw6AoPAES2r49xdgGWnxN+Yq-N88YlbI8iZAqTFTPMtjfsmqiLFqNRNbSBotS0bVBuksgWJlvWZAN+XxH+4pKA41iSpYYiyA5dr6vSOKYmAC2epRpjUd1ui2H1W0Klokggqq6SSrYVjTYc65zfSGLGiJt3di+8RJmK6TSJkK1-GBCojgOXwvZNmTvFIZ0boWJY4PiENLa+dgiC4zgzDMyaJMsAEJHKiYKEdjhWDGti440QmIUTj6tZpcR-WIoYldIY7OJNpTbYqDizmkk2pCdjBAZzerxThiUeV5xMC4g2gzlk5knSuDiTdL4bAukJVbJq1n2GI1WuEAA */
  id: "deposit-ui",

  context: ({ input }) => ({
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
    generatedAddressResult: null,
  }),

  on: {
    LOGIN: {
      actions: [
        assign({
          userAddress: ({ event }) => event.params.userAddress,
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
            // "sendToDepositNearRefClearError",
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
          entry: "extractDefuseAssetId",

          invoke: {
            src: "formValidationBalanceActor",

            input: ({ context }) => {
              return {
                defuseAssetId: context.defuseAssetId,
                userAddress: context.userAddress,
                network: context.formValues.network,
              }
            },

            onDone: [
              {
                target: "#deposit-ui.generating",

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
