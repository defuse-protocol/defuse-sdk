import { quoteMachine } from "@defuse-protocol/swap-facade"
import type { SolverQuote } from "@defuse-protocol/swap-facade/dist/interfaces/swap-machine.in.interface"
import { type ActorRefFrom, assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import type { WalletMessage, WalletSignatureResult } from "../../types"
import type { BaseTokenInfo } from "../../types/base"
import { makeSwapMessage } from "../../utils/messageFactory"

type Context = {
  quoterRef: null | ActorRefFrom<typeof quoteMachine>
  tokenIn: BaseTokenInfo
  tokenOut: BaseTokenInfo
  amountIn: bigint
  amountOut: bigint
}

type Input = {
  tokenIn: BaseTokenInfo
  tokenOut: BaseTokenInfo
  amountIn: bigint
  amountOut: bigint
}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const swapIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actions: {
    setError: () => {
      throw new Error("not implemented")
    },
    startBackgroundQuoter: assign({
      // @ts-expect-error For some reason `spawn` creates object which type mismatch
      quoterRef: ({ spawn }) =>
        // @ts-expect-error
        spawn(
          quoteMachine.provide({
            actors: {
              fetchQuotes: fromPromise(async (): Promise<SolverQuote[]> => []),
            },
          }),
          { id: "quoter", input: {} }
        ),
    }),
  },
  actors: {
    signMessage: fromPromise(
      async (_: {
        input: WalletMessage
      }): Promise<WalletSignatureResult | null> => {
        throw new Error("not implemented")
      }
    ),
    broadcastMessage: fromPromise(async () => {
      // todo: Implement this actor
      console.warn("broadcastMessage actor is not implemented")
    }),
    getIntentStatus: fromPromise(async () => {
      // todo: Implement this actor
      console.warn("getIntentStatus actor is not implemented")
    }),
  },
  guards: {
    isSettled: () => {
      // todo: Implement this guard
      console.warn("isSettled guard is not implemented")
      return true
    },
    isPending: () => {
      throw new Error("not implemented")
    },
    isNotFoundOrInvalid: () => {
      throw new Error("not implemented")
    },
    isIntentRelevant: () => {
      // todo: Implement this guard
      console.warn("isIntentRelevant guard is not implemented")
      return true
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6AZRyj3ygGIIB7PME-ANwYGsXZK8BZOLDQwA2gAYAuolAYGvAjiYyQAD0QBWAMwktARj0AOAGziNAFnMB2PQE5xhgDQgAnolv6SVrVavnjAExa5rZ2WgC+4c6omLiExATkfDS0YABOaQxpJBgANmgEAGZZALYkvFSCsMJiUipyCkp4KuoIWMHmJAHmhuJaQeZa4uLG-s5uCIZ6ViTGJhrdvUNWJpHR6Nj4RKQAQploEADGaLCKeFAABACS8YT0TCzsXDzEEFU1YBLSSCANOIrKH6tDxdabmCwBXwBQzeDTjRB6DokPTWcx6AKQrRzWwaNYgGKbW6JPYMA7HU40a5E1IZLI5fJFUrlV7vESfOo-P4A5pAxBYaaGLrGYxaDziIwBULmeEIRE4oUooxWYVWcQBPEEuLbRIANXSOEKLkpN21tC+9Xk-yaLXcehItm8DtsIWMGg0roCMr04m8JDM-T0gQW2I1Gy1CRIerSBqN5ypptEem+skt3JtCBCAS6GnEaP83RzxlsXvBgt8maCtmMK1sodiWwjAHEwAQzpcTQkLmQCAUAK6we7MVh4DjccphhukZut41Ers9gj9hBPY7cr7mzmp628hBaDRdZ3QlaGLSGZ1WCxewJZgLDHNWeyGKbmdVRfETokkadt+Od7t9gdGCHJ4x01SdEm-WdtXnADlxHBhVyadckwtRpAVAVosUFV0tFFCwX1MDEtCvDEujvH1H2fV91nrT9ILjDtCBgxcB3STJsjyApijSMowLolsf0YghmKXFcCiQqQNxTNCeQwvl5VdWxIUMAJAl8LFpVcBFtE6EJrG9GxBgfQw60JbUkioFIgMeeDQL4VkxBQzcZPTLBumMWYAg0FE8O8cVjBlDw7W8Xx3WmWxbCfWs8TwBgIDgFQ+O1VCrXQtQ+VFG8ej6AYhhGMYtIQDRDE6PdzGGJ9VNzUVTPDUgKEs84UrTHcsEsP0PG8FTphWYU9BlGxBULYIcW6Axplq8CSAAYSYQocB4yBmu3OTZVwkhtBxfRMQxSKvRMQVxuVHDA20CI3ySiMADkGGEgAxBhezwCALiyKk2DQXIcAgZa0taF9OimN0rG6JSHWmfbit0QJBki09yovSbPwAQQAIyyIgfuc1LZPStpoR0AJvWCItpkDXD9vsLplUzIZcIvYwkfMkkyROQSiV+3HWjapxCoMEISF6AwsVCYYeiZiMoxjKCEk59MDH3cQcSLEY7HPNUvWGLMUV6DQgpFPRtAl0grpbFAsk4C4AFFaTSOXWu9cRQW6DTXVdBw4T5s8nchUYlLpnx3WNiCBJlpj-xY+3Vr8EhwUsAjxV6CqSzsWPIpPVVJRPSJIiAA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      ...input,
    }
  },

  id: "swap-intent",

  initial: "Signing",

  entry: ["startBackgroundQuoter"],

  output: () => ({}),

  states: {
    Signing: {
      invoke: {
        id: "signMessage",

        onError: {
          target: "Aborted",
          actions: "setError",
        },

        src: "signMessage",

        input: ({ context }) => {
          return makeSwapMessage({
            tokenDiff: [
              [context.tokenIn.defuseAssetId, -context.amountIn],
              [context.tokenOut.defuseAssetId, context.amountOut],
            ],
            signerId: "signer.near",
            recipient: settings.defuseContractId,
            deadlineTimestamp:
              Math.floor(Date.now() / 1000) + settings.swapExpirySec,
          })
        },
        onDone: [
          {
            target: "Verifying Intent",
            guard: { type: "isSigned", params: ({ event }) => event.output },
          },
          {
            target: "Aborted",
            reenter: true,
          },
        ],
      },

      description:
        "Generating sign message, wait for the proof of sign (signature).\n\nResult:\n\n- Update \\[context\\] with selected best quote;\n- Callback event to user for signing the solver message by wallet;",
    },

    Confirmed: {
      type: "final",

      description: "The intent is executed successfully.",
    },

    "Not Found or Invalid": {
      description:
        "Intent is either met deadline or user does not have funds or any other problem. Intent cannot be executed.",
      type: "final",
    },

    Aborted: {
      type: "final",
    },

    "Broadcasting Intent": {
      invoke: {
        id: "sendMessage",
        input: {
          message:
            "I received signature from user and ready to sign my part (left+right side of agreement)",
        },
        src: "broadcastMessage",
        onError: {
          target: "Network Error",

          actions: "setError",

          reenter: true,
        },
        onDone: {
          target: "Getting Intent Status",
          reenter: true,
        },
      },
      description:
        "Send user proof of sign (signature) to solver bus \\[relay responsibility\\].\n\nResult:\n\n- Update \\[context\\] with proof of broadcasting from solver;",
    },

    "Verifying Intent": {
      always: [
        {
          target: "Broadcasting Intent",
          guard: "isIntentRelevant",
        },
        {
          target: "Not Found or Invalid",
          reenter: true,
        },
      ],
    },

    "Network Error": {
      type: "final",
    },

    "Getting Intent Status": {
      invoke: {
        src: "getIntentStatus",

        onDone: [
          {
            target: "Confirmed",
            guard: "isSettled",
            reenter: true,
          },
          {
            target: "Not Found or Invalid",
            guard: "isNotFoundOrInvalid",
            reenter: true,
          },
        ],

        onError: {
          target: "Network Error",
          reenter: true,
        },
      },
    },
  },
})
