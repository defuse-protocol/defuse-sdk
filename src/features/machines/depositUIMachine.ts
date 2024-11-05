import { parseUnits } from "ethers"
import { assetNetworkAdapter } from "src/utils/adapters"
import { type ActorRefFrom, assertEvent, assign, setup } from "xstate"
import type { SwappableToken } from "../../types"
import { BlockchainEnum } from "../../types"
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
      depositNearResult: (_, value: DepositNearMachineOutput) =>
        value.status === "DEPOSIT_COMPLETED" ? value : null,
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
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZhADgB0AJgAsYgOyN5ANgDM89crEBWADQgAnojwbG07QE4xOpSrGrlAX0f6UHXIRIVK5AKoAVJlYkEHcuXn4hBDxRbQk5YVUZCxlU7QdVfSNo03MrG3k7dWdXNEwPIglIXCweKGIAZV8AIQBZakCWfjDuPhCo4SlVCST5CylLRmSxRm0ZLONksynGQYsNeTFlKWESkDdy-ErqrjriOgAFAKDuw97I43E4ifSLYXlE5OVlecNF4TM4lUgwmUgsjHU8j2B04niqEBqdQkADcAIYAGywEFRp3qEF4YAktWR6AA1oSYRUsPDEVAURisTjalAEMT0ABjJm8II3EI9CL9YwKSSqGbKJTaOYA5QLaLCNQSGbpVRKew2CyqaFlWHHBG4+mY7G44j4niEtnkiSUo7Uk7Mg2M3GsngkznhHg84TBdh3AWgKJ4BRxZQfKSKGSMKRg+WyvBSMRSCRaKPyGTKCzaMEaGRasJw2AEABGAFtcMbTeaXWSKdrcLQwKiAE4AJTAADNeT7OPdBQg5MoJGMtnJxoVtIwM7GI2Z1tp7FpGJHxVCXPtazaJAWS2XmcQwI3G+hGxJUOicW2j8Wrev603Wx2unzfX1-Yg5PIJG852oAWm5FJY2BD9GBDKRlDmeQhgTXNDjhGAzUbJkzgrIkq0ta1KDABCcTAABBCAIEbOBYHvTtQmfB4+zkEYwXBBMQxAsRfmyGJ5RGD4ZElJjEnUbQnFXa04Kw-ckPqfdD2PU9z0va8wkw7CcDwgiiNgEj2zI-kX0EN9qIsdZrB2DMHC0GU-miYEaIUad4x41R0mcVceHQFB4BCQSiFubs-W06J1mEJNQ3DSNo1Mli5ziIFEmESVVAzbRdgE9c4TtOpPJqbyA3GYYQ0GIKozeULFnWJN7GENMwzEeVRX40o811WkiQgdEwDS91KJMIYRmioc9JVCxvinCcJHHKxwOSCNxwUGCdVtPV7TRQ1RNantX2iIZhmEdYZDA8KKtSWNEg-TMIR0JjxRVbbpqpTci1LHBcWWjK30SCQlCsWdxATFI9DMvAlmGtQ+P7RIExzRK6upeCRIep8vK0qJRQsJMlAmFZRFUeNMl+qNJEjPjwL0tMVH6hzHCAA */
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

        onDone: {
          target: "editing",
          actions: [
            {
              type: "setDepositNearResult",
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

    generating: {
      invoke: {
        id: "depositGenerateAddressRef",
        src: "depositGenerateAddressActor",

        input: ({ context, event }) => {
          // TODO TypeError: Do not know how to serialize a BigInt
          // assertEvent(event, "AUTO_SUBMIT")
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
