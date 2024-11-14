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
  type Output as DepositEVMMachineOutput,
  depositEVMMachine,
} from "./depositEVMMachine"
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
      depositEVMRef: "depositEVMActor"
    },
  },
  actors: {
    formValidationBalanceActor: backgroundBalanceActor,
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgCMAZgDsAOgAsANgCsEuQA4FMsSoBMYuWIA0IAJ7CVKgJxTx2xWK0WVIlQF9nhlB1yESFSuQCqACpMrEggnly8-EIIMlJqKnIichISCuYKKhI6hiYIeGaW1lq29uaOLm4gHpheRFKQuFg8UMQAyv4AQgCy1MEs-BHcfGExclpS6mJKEnZi86mJucIlcrKMuloSjAqZ5jIiru5otfj1jVwt7V29wSKh7KfD0YhyjFLmjNpaTm9bIhJ9st8iIZAp1hkJFlGCUtLsZEdqidON4GhAmlc6AAFIIhQZPKKjYROMRSabZHSgn7maZyYF4ckfETiMQyH7JcxORE1FHndGXKBSABuAEMADZYCAigXECC8MBSZpC9AAawVPLqWDRGMFoolUoFCCV6AAxtLhiE8WEhoTQDE8CkJmpGHINOVzJyRFp6QoxCIpIxGOIZDsvWJ9giqhqzlqLs1deLJearnKeArjWqpNHUXGWsLEwb40aeMqzZEeJb7vjOM8iflHOCZAcAUk5B7m-TJHFkhYtAcQ4DUtzkZqpLACAAjAC2uAFtDAIoAToEBLL5YqS6r1SOcPOlwAlMAAMytjxrtsEiAs7xk2h2jEBOlZdOMKyhZJUQbbvpZCmHEVRGA00XZNWlTdNN0zaNKDAYDpTAABBCAIEXOBYEPE8BmtAkRjtRAQ3BGEaREL5dhpRR6RkGkpCSJQkhED0XSosR-1OVECFQA0wE6cURR4E0wGIARYBweCpBFI8cDARcAAotEDRgAEpZR3djOPgnixT4gTT3CHCXgQLZpE-dQzHkSRMhkTtMg+WiXRKcwJAY1jeS1cdp1neMAFEADVuhXNc0w3ZUoJ3Xzugw3SbVwy8EAsf0nAUBinB+GRshEekRCSmjEnJB82TS8RXCqHh0BQeAwmzIhqyaC97QjKx9j7MQHzkN5lHpNJSXkJtXTBLKVF0FzR1zKAavLAyCnMNYGIKlrlHal88gdZJZABNKfhUKivUqY4AL5HVFQgMUwHG2s8PrW9Grm1rFp9ewmQkDQLEyTRmWGmNtQFfN9VAs66pWfZ4nMLZVGmmkfys18QXSKQnI0B9HMUQFdqRfa3MnGccDnBdlxiM9apimIFC+SZVHSNQ+yy30DGhvBVg+LZEcSPRwyUD7ANg6S-uw88icQSQ1jZTQSicxwH19ekkhUWymy2z8tE+SM9rY+oOK4zTtNO3nCYMmlLAUV1GA9dIoUyb06d0G8klvB8SJbFio1U+p3KxgVwpXf7+YQEnLCcv1A0HNq4UykMpCfVLVDZBi-2KoA */
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

    submittingNearTx: {
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
          if (!depositAddress) {
            throw new Error("Deposit address is missing")
          }
          if (
            context.formValues.token == null ||
            !context.userAddress ||
            context.tokenAddress == null
          ) {
            throw new Error("Token or account ID is missing")
          }
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
