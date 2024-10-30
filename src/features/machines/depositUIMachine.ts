import { parseUnits } from "ethers"
import type { providers } from "near-api-js"
import { isBaseToken } from "src/utils"
import {
  type ActorRefFrom,
  assertEvent,
  assign,
  fromPromise,
  sendTo,
  setup,
} from "xstate"
import type { SwappableToken } from "../../types"
import { DepositBlockchainEnum, type Transaction } from "../../types/deposit"
import { backgroundBalanceActor } from "./backgroundBalanceActor"
import {
  type Output as DepositGenerateAddressMachineOutput,
  depositGenerateAddressMachine,
} from "./depositGenerateAddressMachine"
import { depositNearMachine } from "./depositNearMachine"

export type Context = {
  error: Error | null
  balance: bigint
  nativeBalance: bigint
  formValues: {
    token: SwappableToken | null
    network: DepositBlockchainEnum | null
    amount: string
  }
  parsedFormValues: {
    amount: bigint
  }
  depositResult: string | null
  depositGenerateAddressRef: ActorRefFrom<
    typeof depositGenerateAddressMachine
  > | null
  tokenList: SwappableToken[]
  userAddress: string
  defuseAssetId: string | null
  generatedAddressResult: DepositGenerateAddressMachineOutput | null
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
            network: DepositBlockchainEnum
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
            network: DepositBlockchainEnum
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
      depositResult: (_, value: string) => value,
    }),
    setDepositGenerateAddressResult: assign({
      generatedAddressResult: (_, value: DepositGenerateAddressMachineOutput) =>
        value,
    }),
    clearDepositResult: assign({ depositResult: null }),

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
              `${token.chainName.toLowerCase()}:${token.chainId.toString()}` ===
              context.formValues.network
          )?.defuseAssetId ?? null
        )
      },
    }),
    spawnGeneratedAddressActor: assign({
      depositGenerateAddressRef: (
        { context, spawn, self },
        output: { accountId: string; chain: DepositBlockchainEnum }
      ) => {
        return spawn("depositGenerateAddressActor", {
          id: "deposit-generate-address",
          input: output,
        })
      },
    }),
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
        return context.formValues.network === DepositBlockchainEnum.NEAR
          ? context.balance > context.parsedFormValues.amount
          : true
      }
      return true
    },
    isDepositNonNearRelevant: ({ context }) => {
      return (
        context.formValues.network != null &&
        context.formValues.network !== DepositBlockchainEnum.NEAR &&
        context.defuseAssetId != null &&
        context.userAddress != null
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZhADgB0AJgAsYgOyN5ANgDM89crEBWADQgAnojwbG07QE4xOpSrGrlAX0f6UHXIRIVK5AKoAVJlYkEHcuXn4hBDxRbQk5YVUZCxlU7QdVfSNo03MrG3k7dWdXNEwPIglIXCweKGIAZV8AIQBZakCWfjDuPhCosSl45Rkk7SlxZRHhZSzjKQcJMWEVK1VVcfkxGRKQN3L8SuquOuI6AAUAoO6D3sjjcTipbXSLFcTkqZk56JlhM3EqmEUmeUgsjHU8l2+04niqEBqdQkADcAIYAGywEFRJ3qEF4YAktWR6AA1oSYRUsPDEVAURisTjalAEMT0ABjJm8ILXEI9CL9YwaIaMZRSeQWZSiMQWVRiWaGB6MGQSWz-KbTCzyMHQsqwyqwAgAIwAtrhccR8TxCWzyRJKThaGBUQAnABKYAAZrz2LcBaAojJLBJtPYUiNlFYJjofjFgSGpMrGIxwZD7DsXHs9VSJIbTebmcQwC6XegXRJUOicZ6yyb7dnHc73V6faE-X0A4gZMozM9hCkttoIYMlLGxdJRKLBvJEhZZFDMw64TBrS6macrTaeCS7Q7KGBVziwABBCAQF1wWAe71dPnt+4IGRSSQ96bCIerKSxuXyeIbDQjFq2gyDOC6lGEy4HsW671MWpblpW1a1vWYT7oeOAnmeF6wFeLa3r6nB3IKj5gtI8ijD2hQpjMDjfqoFghiMyYpBsUzArqEFHAiuL0pi2IWpuRLbmSFINnCxzMrxjK4qywmcuEPA8sIwQETU-qCMYChxMoM7igoypaCBsYLHE6xaFoligqBziZjw6AoPAIRLkQNyEepUR4FqwgSDpwJbIo3bbPIsaWHEViRowwFghY2jahxBzidxzKuWpHYadEc6qD5un+QZQWxskv5aECgIjEOkVOIuYlcbSRIQOiYApQpD4mAsEhArFVgWLKKZTAVKYhim8rASkkWMAo8X6tSElImifEwU1RGdtECxZf25FSMooabNs3yKtEiS-uMw6ht2ELKlIk05nmZo4Lii3uYgcpxH8lgjIUwEQsIxkTKqGgJFqQKFKoV2HNSK7Qfdd5uWlUQON5LHPqGwI6CMIXjfE8pvFoYKqMqwg2Y4QA */
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
    depositResult: null,
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

          if (context.formValues.token == null || context.userAddress == null) {
            throw new Error("Token or account ID is missing")
          }
          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
          }
        },

        onDone: {
          target: "editing",
        },

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },
    },

    generating: {
      invoke: {
        id: "depositGenerateAddressRef",
        src: "depositGenerateAddressActor",

        input: ({ context, event }) => {
          // TODO TypeError: Do not know how to serialize a BigInt
          // assertEvent(event, "AUTO_SUBMIT")

          if (
            context.formValues.network == null ||
            context.userAddress == null
          ) {
            throw new Error("Chain or account ID is missing")
          }
          return {
            accountId: context.userAddress,
            chain: context.formValues.network,
          }
        },

        onDone: {
          target: "editing",
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
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
