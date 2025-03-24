import { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import { assign, fromPromise, setup } from "xstate"
import { config } from "../../../config"

export const otcMakerConfigLoadActor = setup({
  types: {
    context: {} as {
      protocolFee: null | number
    },
  },
  actors: {
    loadProtocolFee: fromPromise(fetchProtocolFee),
  },
  actions: {
    setProtocolFee: assign({
      protocolFee: (_, event: { output: number }) => event.output,
    }),
  },
}).createMachine({
  context: {
    protocolFee: null,
  },

  initial: "loading",

  states: {
    loading: {
      invoke: {
        src: "loadProtocolFee",
        onDone: {
          target: "loaded",
          actions: {
            type: "setProtocolFee",
            params: ({ event }) => event,
          },
        },
        onError: "error",
      },
    },
    loaded: {
      type: "final",
    },
    error: {
      after: {
        1000: "loading",
      },
    },
  },
})

export async function fetchProtocolFee() {
  const nearClient = new providers.JsonRpcProvider({
    url: "https://nearrpc.aurora.dev",
  })

  // Warning: `CodeResult` is not correct type for `call_function`, but it's closest we have.
  const output = await nearClient.query<CodeResult>({
    request_type: "call_function",
    account_id: config.env.contractID,
    method_name: "fee",
    args_base64: btoa(JSON.stringify({})),
    finality: "optimistic",
  })

  const stringData = String.fromCharCode(...output.result)
  const value = JSON.parse(stringData)

  if (typeof value !== "number") {
    throw new Error(`Expected number, got ${typeof value}`)
  }

  // in bip: 1 bip = 0.0001% = 0.000001
  return value
}
