import { quoteMachine } from "@defuse-protocol/swap-facade"
import type { SolverQuote } from "@defuse-protocol/swap-facade/dist/interfaces/swap-machine.in.interface"
import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  type OutputFrom,
  assign,
  fromPromise,
  setup,
} from "xstate"
import { settings } from "../../config/settings"
import * as solverRelayClient from "../../services/solverRelayHttpClient"
import type * as types from "../../services/solverRelayHttpClient/types"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "../../types"
import type { DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import { prepareSwapSignedData } from "../../utils/prepareBroadcastRequest"
import {
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"
import type { queryQuoteMachine } from "./queryQuoteMachine"

type Context = {
  quoterRef: null | ActorRefFrom<typeof quoteMachine>
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  quote: OutputFrom<typeof queryQuoteMachine>
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  amountIn: bigint
  messageToSign: null | {
    walletMessage: WalletMessage
    innerMessage: DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult | null
  error: unknown
  intentStatus:
    | Extract<
        types.GetStatusResponse["result"],
        { status: "SETTLED" | "NOT_FOUND_OR_NOT_VALID_ANYMORE" }
      >
    | { status: "UNKNOWN"; intent_hash: string }
    | null
}

type Input = {
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  quote: OutputFrom<typeof queryQuoteMachine>
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  amountIn: bigint
}

type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
  status: "aborted" | "confirmed" | "not-found-or-invalid" | "generic-error"
}

export const swapIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actions: {
    setError: assign({
      error: (_, params: { error: unknown }) => params.error,
    }),
    logError: (_, params: { error: unknown }) => {
      console.error(params.error)
    },
    assembleSignMessages: assign({
      messageToSign: ({ context }) => {
        const innerMessage = makeInnerSwapMessage({
          amountsIn: context.quote.amountsIn,
          amountsOut: context.quote.amountsOut,
          signerId: context.userAddress,
          deadlineTimestamp: Math.min(
            Math.floor(Date.now() / 1000) + settings.swapExpirySec,
            context.quote.expirationTime
          ),
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
    setIntentHash: assign({
      intentStatus: (_, intentHash: string) => ({
        status: "UNKNOWN" as const,
        intent_hash: intentHash,
      }),
    }),
    setIntentStatus: assign({
      intentStatus: (_, intentStatus: Context["intentStatus"]) => intentStatus,
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
    publicKeyVerifier: publicKeyVerifierMachine,
    signMessage: fromPromise(
      async (_: {
        input: WalletMessage
      }): Promise<WalletSignatureResult | null> => {
        throw new Error("not implemented")
      }
    ),
    broadcastMessage: fromPromise(
      async ({
        input,
      }: {
        input: {
          signatureData: WalletSignatureResult
          quoteHashes: string[]
        }
      }) => {
        // todo: retry on network error
        const result = await solverRelayClient.publishIntent({
          signed_data: prepareSwapSignedData(input.signatureData),
          quote_hashes: input.quoteHashes,
        })
        // todo: check status
        return result.intent_hash
      }
    ),
    pollIntentStatus: fromPromise(
      ({
        input,
        signal,
      }: { input: { intentHash: string }; signal: AbortSignal }) =>
        waitForIntentSettlement(signal, input.intentHash)
    ),
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
    isSignatureValid: (
      { context },
      signature: WalletSignatureResult | null
    ) => {
      if (signature == null) return false

      switch (signature.type) {
        case "NEP413":
          return (
            // For NEP-413, it's enough to ensure user didn't switch the account
            signature.signatureData.accountId === context.userAddress
          )
        case "EIP712":
          // For EIP-712, we need to derive the signer address from the signature
          throw new Error("EIP712 signature is not supported")
        default:
          throw new Error("exhaustive check failed")
      }
    },
    isIntentRelevant: ({ context }) => {
      // Naively assume that the quote is still relevant if the expiration time is in the future
      return context.quote.expirationTime * 1000 > Date.now()
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6HCAGzAGIBtABgF1FQMB7WHAnNvFkAB6IAjAGYAHCXoAmesIAsogKxLxSgOzCZAGhABPRKPnCS4uaOlqlw4dPUA2AL6PdqTLkLECJAMo4oePhQ1BC8YGR4AG5sANbhnAEAsnCwaDAMzEgg7JzcvPxCCML2JMLW9g5K9vKKoqL2ugYI9uLyJACc9KLqqrbS9kry0s6u6Nj4RKR+AUEhYRHRcSQJeMmwqenCmawcXDx8WYVYlm309v3qMvbt1pfqjYjXbeL2Nu0S8u1l0kojIG7jTxTfyBPDBMAAJwhbAhJAwFDQBAAZjCALbLEFrDZgDL8HJ7fKHRBYJT0egkFQycTU9R2JTtVoPBAqNqidqWHrSCzyS7CP4AjyTbwANUhOCReiCAAIAAoAVwARhQcABjKUAaTAellELgxBVNFCeHC+EW8TGgq8JFFEPFkrBssVyrVmu1Mt1sH1YAQprYKsR+wyuKy+LyB1AhSMJFE9Hp1xa6na8iU0mETKTz3E72qlna50s-ItEytNrt0vlStVGq1Or1eANc2NC1i5vcxdIpYl5adVddtc99e9vv9YaDWzxuzDBWJ0huJGkNVn-Vz4mEjP0iAzpiz9SGWfz7ULbaBIrFXYdFed1bdHq91Eh0Nh8MRKIh6IF7dPtvPUEdlZdNbunWBo+lEfoBrwQZMBOuT7NOCAkjYJDqKIwhfKuZJoZoTLiKmpjyPQnzVLG1SHi4-xFieJAAELQmgED+rA3AOgAkiejYmmBSwDhAWJpDi0EhpOcFEgg4jqB0LT0OIyg9EoEhGEyYg1KUPLGNIdj1FmvzkR+VG0Ww9GMcxv5sUK95QjCcIIsiaLLMQvEpPxwY7LBhIRsSpLSKYFTtHm9CaP0AyiEpaFKBS9ivPI5xyNFihHoCQrWme9qmexLnZMJ7mCIgLzIQuGioTyRh+e0SkBSUkWyNJSbsuoQwJZaHYpdKZleHQ45CW54Y5QgnzeT8hEKOcyZnGVG5FMmkjqPV7Jcnm6hZo1n4kAA4mABAmVKbWEFKPgEIicqwBxzbcZRSXrZtrUnntB0EEdoHRCOgZMBloYiR5CDKPOSYnHUaj5uISn5vOZKkom0mrg1unnVal1bTtBC3Ydx1GpxZrLLDpDw9dQrI-dsCPeBo6vZ1rkEj1kYtCQwVsoMQz2DIXLAxpoOxgFnTUgowww8eF0bQjN37SjFmPtZL52Xp-NXaxQt3Q9w4QXgUHbJl3XwSSAXIZcdRDGuiiDEpNRtPV5zKHYWZoXyfx4GwEBwPwUteDBFMayo7TIah6FaHI7S0kp30yfYCnUnYPKqMtVHkFQLtTqJCjklmNR+7O7JoRYTL9B7DLibJwgoTNPOjHzVrTKCUCxx9vVYJ80aKG8xSyLShFMgzJDyOJMg3AMfkSJHSWdqlf5Xn2QEDgalfZYUPI08mi2LaofurvcE2rh7qEzSmPTXGy8j91aBlGWgTG487XWu6JNdAxNNi12YNj1F8ZId-vzXfkPiOT5TIixlItLvLOGSNQBjXyaFoBQ0Y-IyACtYGM-RX7eBxrLPGwsCZf3gtcUGpIO4xnzgpFeYDjAe1JNYWMPJg7SQQSQAAwrwJEOA3yQHQaJKo7cGQtHQotAi5wlBKReJIGwa4fg3DZIzUQVCABybAkYADE2ByjwBAKUMJtpRDQMqCAzDPpDGeGUDQC52R+3znw1Q0YRpshkq0GBVCACCCoYREE0efOOn1ji-2zFUGwi1870HeHwzo84HDJlsAyPW4gqHrWNLaNUABRSyEItHV1JJISKYgXh2DsPVUBIgszkjsNUFMXIAqJmcM4IAA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      messageToSign: null,
      signature: null,
      error: null,
      intentStatus: null,
      ...input,
    }
  },

  id: "swap-intent",

  initial: "idle",

  entry: ["startBackgroundQuoter"],

  output: ({ event }) => {
    return {
      // @ts-expect-error I don't know how to type "done" event
      status: event.output.status,
    }
  },

  states: {
    idle: {
      always: {
        target: "Signing",
        reenter: true,
      },
    },

    Signing: {
      entry: "assembleSignMessages",

      invoke: {
        id: "signMessage",

        onError: {
          target: "Generic Error",
          reenter: true,
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],
        },

        src: "signMessage",

        input: ({ context }) => {
          assert(context.messageToSign != null, "Sign message is not set")
          return context.messageToSign.walletMessage
        },

        onDone: [
          {
            target: "Verifying Public Key Presence",
            guard: {
              type: "isSignatureValid",
              params: ({ event }) => event.output,
            },

            actions: {
              type: "setSignature",
              params: ({ event }) => event.output,
            },

            reenter: true,
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

    "Verifying Public Key Presence": {
      invoke: {
        src: "publicKeyVerifier",
        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")

          return {
            nearAccount:
              context.signature.type === "NEP413"
                ? context.signature.signatureData
                : null,
            nearClient: context.nearClient,
            sendNearTransaction: context.sendNearTransaction,
          }
        },
        onDone: [
          {
            target: "Verifying Intent",
            reenter: true,
            guard: {
              type: "isTrue",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Aborted",
            reenter: true,
          },
        ],
        onError: {
          target: "Generic Error",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],

          reenter: true,
        },
      },
    },

    "Broadcasting Intent": {
      invoke: {
        src: "broadcastMessage",

        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          assert(context.messageToSign != null, "Sign message is not set")

          return {
            quoteHashes: context.quote.quoteHashes,
            signatureData: context.signature,
          }
        },

        onDone: {
          target: "Polling Intent Status",
          reenter: true,
          actions: {
            type: "setIntentHash",
            params: ({ event }) => event.output,
          },
        },

        onError: {
          target: "Generic Error",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],

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

    "Polling Intent Status": {
      invoke: {
        src: "pollIntentStatus",

        input: ({ context, event }) => {
          assert(context.intentStatus != null, "Intent Status is not set")
          return { intentHash: context.intentStatus.intent_hash }
        },

        onDone: [
          {
            target: "Confirmed",
            guard: "isSettled",
            reenter: true,
            actions: {
              type: "setIntentStatus",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Not Found or Invalid",
            reenter: true,
            actions: {
              type: "setIntentStatus",
              params: ({ event }) => event.output,
            },
          },
        ],

        onError: {
          target: "Generic Error",
          reenter: true,
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],
        },
      },
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

    "Generic Error": {
      type: "final",
      output: {
        status: "generic-error",
      },
    },
  },
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

async function waitForIntentSettlement(
  signal: AbortSignal,
  intentHash: string
) {
  let attempts = 0
  const MAX_INVALID_ATTEMPTS = 3 // ~1.5 seconds of waiting

  while (true) {
    signal.throwIfAborted()

    // todo: add retry in case of network error
    const res = await solverRelayClient.getStatus({
      intent_hash: intentHash,
    })

    if (res.status === "SETTLED") {
      return res
    }

    if (res.status === "NOT_FOUND_OR_NOT_VALID_ANYMORE") {
      // If we keep getting NOT_VALID then we should abort
      if (MAX_INVALID_ATTEMPTS <= attempts) {
        return res
      }
      attempts++
    }

    // Wait a bit before polling again
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}
