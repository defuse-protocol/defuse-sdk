import { assetNetworkAdapter } from "src/utils/adapters"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import type { SwappableToken } from "../../types"
import { BlockchainEnum } from "../../types"
import { parseUnits } from "../../utils/parse"
import { isBaseToken, isUnifiedToken } from "../../utils/token"
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
import { poaBridgeInfoActor } from "./poaBridgeInfoActor"

export type Context = {
  error: Error | null
  balance: bigint
  nativeBalance: bigint
  /**
   * The maximum amount that available on the user's balance minus the cost of the gas.
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
  userAddress: string
  defuseAssetId: string | null
  tokenAddress: string | null
  generatedAddressResult: DepositGenerateAddressMachineOutput | null
  depositNearResult: DepositNearMachineOutput | null
  depositEVMResult: DepositEVMMachineOutput | null
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
          }
        }
      | {
          type: "LOGOUT"
        },
    children: {} as {
      depositNearRef: "depositNearActor"
      depositEVMRef: "depositEVMActor"
    },
  },
  actors: {
    fetchWalletAddressBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
    depositEVMActor: depositEVMMachine,
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
    setDepositGenerateAddressResult: assign({
      generatedAddressResult: (_, value: DepositGenerateAddressMachineOutput) =>
        value,
    }),
    clearDepositResult: assign({ depositNearResult: null }),
    clearDepositEVMResult: assign({ depositEVMResult: null }),

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
    // ToDo Add spawn actor which will propogate generated address to depositEVM once we fove got the generated address
    clearUIDepositAmount: () => {
      throw new Error("not implemented")
    },

    fetchPOABridgeInfo: sendTo("poaBridgeInfoRef", { type: "FETCH" }),
  },
  guards: {
    isTokenValid: ({ context }) => {
      return context.formValues.token != null
    },
    isNetworkValid: ({ context }) => {
      return context.formValues.network != null
    },
    isDepositNearRelevant: ({ context }) => {
      return (
        context.balance + context.nativeBalance >=
          context.parsedFormValues.amount &&
        context.formValues.network === BlockchainEnum.NEAR
      )
    },
    isDepositEVMRelevant: ({ context }) => {
      return (
        context.balance + context.nativeBalance >=
          context.parsedFormValues.amount &&
        (context.formValues.network === BlockchainEnum.ETHEREUM ||
          context.formValues.network === BlockchainEnum.BASE ||
          context.formValues.network === BlockchainEnum.ARBITRUM)
      )
    },
    isBalanceSufficientForEstimate: ({ context }) => {
      if (context.formValues.token == null) {
        return false
      }
      const token = context.formValues.token
      // For all Native tokens, we should validate wallet native balance
      if (isUnifiedToken(token) && token.unifiedAssetId === "eth") {
        return context.nativeBalance > 0n
      }
      return context.balance > 0n
    },
    isDepositNotNearRelevant: ({ context }) => {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgCMAZgDsAOgAsANgCsEuQA4FMsSoBMYuWIA0IAJ7CVKgJxTx2xWK0WVIlQF9nhlB1yESFSuQCqACpMrEggnly8-EIIMlJqKnIichISCuYKKhI6hiYIeGaW1lq29uaOLm4gHpheRFKQuFg8UMQAyv4AQgCy1MEs-BHcfGExclpS6mJKEnZi86mJucIlcrKMuloSjAqZ5jIiru5otfj1jVwt7V29wSKh7KfD0YhyjFLmjNpaTm9bIhJ9st8iIZAp1hkJFlGCUtLsZEdqidON4GhAmlc6AAFIIhQZPKKjYROMRSabZHSgn7maZyYF4ckfETiMQyH7JcxORE1FHndGXKBSVAAJzQAENhWLIjxiHiwkNCaAYgytBNGNsRFoZOrtOYtPTxBMoV8wU4lFpygpuci6lg0RjBQA3MUAGywEClzVaEF4YCkzUd6AA1n6ebb7QKpM63R6BQgA+gAMae3ghOWPTjPIn5WakuFiHZpRjMrIyekycqyckF8ycnYqBFVMNnO0XL1R13uz1XH08P0JkNSZuotstDsx7tQeM8QPJ6Vp+74zOKwSmETgmQHAFJOS1rf0yRxZIWLWg9XmVLWiKo2AEABGAFtcALaGAJYEBMRe-2Z8HQzacFfCUACUwAAM3TcICRGJVEAsd4ZG0HZzx0Vk6WMFYoTJFRi13BQxBZK0mwA1EYD7SUBS-X1-V-Qdm0oMByKlMAAEEIAgUVYFgUCIIGeVoJeWIdikGEaREL5dhpRRyxpKQkiUJIRFrRg5ArMQr1OVECFQWMwE6V0xR4RMwGIARYBwZipDFMCcDAYUAAotEYZyAEovxI+ptN0-SXUM4zIIVGDVwQLZpBw9QzHkSRMjLDD8mmFQPnklSSgvJSNN5O1b0fZ8vQAUQANW6D8qL7GjAzogDCu6HiAoE7MLBEKw1CUpwfhkbIRANBQmtUPQlHVNkOvEVwqh4dAUHgMJhyIJcmhXZV9iPfYtQLZQ3mUek0lJeRN00cpd0cIjjmvPkHTm6VBIKcw1iUoa1rkDb0LyPAd1kAEDh6xhENUCQMvDUdBXdF0wAurNYPyBtEru1b1UeuH6QUewmQkDQLEyTRmX+lsI3bEVxQo8GoOXILlWSOIDvXcYFG+6wJANaYRILMxGCkwFlGxkd+XbaMuwFMGFuEbZpB0C8bp+alzANRwPlZhRVM0dJws5+psqfHAXzfYUPwF0nEBpxL5bUS1T12eZ6VWD4tnPRI9DESEVbtMi7MnXXBMkNY2U0EoJCccTtvpJJEpuzcodE77HakLzmJ8vzQf4knBJpSx5e1Wt0ihTJ9Tihk3lkJJEPVcTt3U4jTqy+91YFaqdYT+a9YQGnLF9gjnPZx64QNbUpFQ9rVDZJSiNcIA */
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
    depositGenerateAddressRef: null,
    tokenList: input.tokenList,
    userAddress: "",
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
        }),
      ],
    },

    LOGOUT: {
      actions: assign({
        userAddress: () => "",
        formValues: {
          token: null,
          network: null,
          amount: "",
        },
      }),
    },
  },

  states: {
    editing: {
      on: {
        SUBMIT: [
          {
            target: "submittingNearTx",
            guard: "isDepositNearRelevant",
            actions: "clearDepositResult",
          },
          {
            target: "submittingEVMTx",
            reenter: true,
            guard: "isDepositEVMRelevant",
          },
        ],

        INPUT: {
          target: ".preparation",
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

        preparation: {
          always: [
            {
              target: "validating",
              guard: and(["isTokenValid", "isNetworkValid"]),
            },
          ],
        },

        validating: {
          entry: "extractAssetIds",

          invoke: {
            src: "fetchWalletAddressBalanceActor",

            input: ({ context }) => {
              assert(context.formValues.network, "network is null")
              assert(context.defuseAssetId, "defuseAssetId is null")
              assert(context.tokenAddress, "tokenAddress is null")

              return {
                defuseAssetId: context.defuseAssetId,
                tokenAddress: context.tokenAddress,
                userAddress: context.userAddress,
                network: context.formValues.network,
              }
            },

            onDone: [
              {
                target: "#deposit-ui.generating",

                actions: assign({
                  balance: ({ event }) => event.output?.balance ?? 0n,
                  nativeBalance: ({ event }) =>
                    event.output?.nativeBalance ?? 0n,
                }),

                reenter: true,
                guard: "isDepositNotNearRelevant",
              },
              {
                target: "idle",

                actions: assign({
                  balance: ({ event }) => event.output?.balance ?? 0n,
                  nativeBalance: ({ event }) =>
                    event.output?.nativeBalance ?? 0n,
                }),

                reenter: true,
              },
            ],
          },
        },
      },

      initial: "idle",
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
          target: "updateBalance",

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

    generating: {
      invoke: {
        id: "depositGenerateAddressRef",
        src: "depositGenerateAddressActor",

        input: ({ context }) => {
          assert(context.formValues.network, "network is null")

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
          }
        },

        onDone: {
          target: "updateBalance",

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
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
