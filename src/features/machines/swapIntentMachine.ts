import { quoteMachine } from "@defuse-protocol/swap-facade"
import type { SolverQuote } from "@defuse-protocol/swap-facade/dist/interfaces/swap-machine.in.interface"
import { type ActorRefFrom, and, assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "../../types"
import type { DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import { isBaseToken } from "../../utils"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import { prepareSwapSignedData } from "../../utils/prepareBroadcastRequest"

type Context = {
  quoterRef: null | ActorRefFrom<typeof quoteMachine>
  userAddress: string
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  amountIn: bigint
  amountOut: bigint
  messageToSign: null | {
    walletMessage: WalletMessage
    innerMessage: DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult | null
}

type Input = {
  userAddress: string
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  amountIn: bigint
  amountOut: bigint
}

type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
  status: "aborted" | "confirmed" | "not-found-or-invalid" | "network-error"
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
    assembleSignMessages: assign({
      messageToSign: ({ context }) => {
        assert(isBaseToken(context.tokenIn), "TokenIn is unified")
        assert(isBaseToken(context.tokenOut), "TokenOut is unified")

        const innerMessage = makeInnerSwapMessage({
          tokenDiff: [
            [context.tokenIn.defuseAssetId, -context.amountIn],
            [context.tokenOut.defuseAssetId, context.amountOut],
          ],
          signerId: context.userAddress,
          deadlineTimestamp:
            Math.floor(Date.now() / 1000) + settings.swapExpirySec,
        })

        return {
          innerMessage,
          walletMessage: makeSwapMessage({
            innerMessage,
            recipient: settings.defuseContractId,
          }),
        }
      },
    }),
    setSignature: assign({
      signature: (_, signature: WalletSignatureResult | null) => signature,
    }),
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
    broadcastMessage: fromPromise(async ({ input }) => {
      // todo: Implement this actor
      console.warn("broadcastMessage actor is not implemented", { input })
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
    isSignatureValid: ({ context }) => {
      // todo: Implement this guard
      console.warn("isSignatureValid guard is not implemented")
      return context.signature != null
    },
    isIntentRelevant: () => {
      // todo: Implement this guard
      console.warn("isIntentRelevant guard is not implemented")
      return true
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6AZRyj3ygGIIB7PME-ANwYGsXZK8BZOLDQwA2gAYAuolAYGvAjiYyQAD0QBWAMwktARj0AOAGziNAFnMB2PQE5xhgDQgAnolv6SVrVavnjAExa5rZ2WgC+4c6omLiExATkfDT0TCzsXDx8grDCYnrSSCByCkp4KuoIWAH+JIEaeuZathre4nrGzm4IHnpePlYaxnpWtraGhraR0ejY+ESkFFQpYABOqwyrJBgANmgEAGabALYkvFQ5eWAShbLyOIrKRZVYweYkNYbiWkFN4uLGfxdRCGEZ1EwaT7fcRWEzTEAxObxUgAIQ2aAgAGM0LBFHgoAACACSyIIqWYrDwHG4Z2IEEuImuUhUJQeZQq7h0ARG5gsAV8AUM3g0wIQejeJEafj0AX5WmMkw08MRcQWiTRDAx2NxNGJpNoaw2W12+yOq1OsDpDLEzKKrMe5WeiCwI0MH2MxmaWnahgCoXMovFLXdjSMVg9VnEAWVs1VCRIADU1jgDi5dSS1bQbiz7g6OT0+rZvEXbCFjBohpDAzCdGYfh0ApCFVMogjY-N40nVim0-i9ZnRAUc6UnqBKiEAh8NOJzI1AryAbZA7y3b4J0FbMZYS2ZrEO6QAOJgAh4wkZhIEsgEfYAV1g5PSVMyZ3bpJIR5P6dJl+vBDvCAybEHRubM7VzdknQQLQNA+UtBVhQwtEmawLEDQJJwCf5p1GBxQXMaNWxVfdEg-U9+wvK9b3vRgKQyGkiLfUivzVH8qIAp8gLKEChzAkdHTHRB5TdcstGaCx8NMWUtDQ2UPiwmF7AmRoCN3JE1XfY8yPPQhWL-e9DU2bY9kOE4Xz3RjNOYijf3-QD9i4qRQLuPj8ywYNy1sflfUCXx5QDVxED0bR3hCaw9BhRofHGSJWzwBgIDgFQGLVYc2VHNRnWaDDzC+H5gm9AEgQChANEMd5oPMf5KssecrBjcz1KWah8VSvNIKwSwSHEDxvF9EZYQ9PRRRsN1p09EJIVnAw6sI191IAYSYA4cHNSBWoggSxVEkhtBafQ5VlcZAxMN0DBGD1tA6bQIlmhr4wAOQYAgCQAMQYG88AgAlNj1Ng0B2HAIHW9LxxqEhQQrKwak8osRmO0rdHnZpELKmElVutT4wAQQAI02Iggd4tL+IyqpBS5cLgmMUIbE9aTiqMewPnDCdvVEwZjHqzHUXRLEcS00lgZJl4csDRpbHB9pxWp8KZ0MLm41ILseyswghfzAwYO6oZ7GGMZrCjaso0lHKzF6T0gpu1TFcSe7jxQTZOAJABRdZNnV9rZY+GUmkBctywcEUGcmcRmcBTy2Z8IYFeIjTPz7bTnsovSPc2vwSF5SwJJ9f4HGXOwM-GRDIz9RCYvCIA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      messageToSign: null,
      signature: null,
      ...input,
    }
  },

  id: "swap-intent",

  initial: "Signing",

  entry: ["startBackgroundQuoter"],

  output: ({ event }) => {
    return {
      // @ts-expect-error I don't know how to type "done" event
      status: event.output.status,
    }
  },

  states: {
    Signing: {
      entry: "assembleSignMessages",

      invoke: {
        id: "signMessage",

        onError: "Aborted",

        src: "signMessage",

        input: ({ context }) => {
          assert(context.messageToSign != null, "Sign message is not set")
          return context.messageToSign.walletMessage
        },

        onDone: [
          {
            target: "Verifying Intent",
            guard: { type: "isSigned", params: ({ event }) => event.output },
            actions: {
              type: "setSignature",
              params: ({ event }) => event.output,
            },
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
      output: {
        status: "confirmed",
      },
    },

    "Not Found or Invalid": {
      type: "final",
      description:
        "Intent is either met deadline or user does not have funds or any other problem. Intent cannot be executed.",
      output: {
        status: "not-found-or-invalid",
      },
    },

    Aborted: {
      type: "final",
      output: {
        status: "aborted",
      },
    },

    "Broadcasting Intent": {
      invoke: {
        id: "sendMessage",
        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          assert(context.messageToSign != null, "Sign message is not set")
          assert(
            context.messageToSign.walletMessage != null,
            "Wallet message is not set"
          )

          return {
            quoteHashes: [],
            signedData: prepareSwapSignedData(
              context.signature,
              context.messageToSign.walletMessage
            ),
          }
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
          guard: and(["isIntentRelevant", "isSignatureValid"]),
        },
        {
          target: "Not Found or Invalid",
          reenter: true,
        },
      ],
    },

    "Network Error": {
      type: "final",
      output: {
        status: "network-error",
      },
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

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
