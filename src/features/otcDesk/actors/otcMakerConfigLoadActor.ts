import { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import { assign, fromPromise, setup } from "xstate"
import { settings } from "../../../config/settings"

export const otcMakerConfigLoadActor = setup({
  types: {
    context: {} as {
      fee: null | number
    },
  },
  actors: {
    loadFee: fromPromise(fetchFee),
  },
  actions: {
    setFee: assign({
      fee: (_, event: { output: number }) => event.output,
    }),
  },
}).createMachine({
  context: {
    fee: null,
  },

  initial: "loading",

  states: {
    loading: {
      invoke: {
        src: "loadFee",
        onDone: {
          target: "loaded",
          actions: {
            type: "setFee",
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

async function fetchFee() {
  const nearClient = new providers.JsonRpcProvider({
    url: "https://nearrpc.aurora.dev",
  })

  // Warning: `CodeResult` is not correct type for `call_function`, but it's closest we have.
  const output = await nearClient.query<CodeResult>({
    request_type: "call_function",
    account_id: settings.defuseContractId,
    method_name: "fee",
    args_base64: btoa(JSON.stringify({})),
    finality: "optimistic",
  })

  const stringData = String.fromCharCode(...output.result)
  const value = JSON.parse(stringData)

  if (typeof value !== "number") {
    throw new Error(`Expected number, got ${typeof value}`)
  }

  // in bip: 1 bip = 0.01% = 0.0001
  return value
}
