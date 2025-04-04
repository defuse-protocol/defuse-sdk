import * as v from "valibot"
import { assign, fromPromise, setup } from "xstate"
import { config } from "../../../config"
import { nearClient } from "../../../constants/nearClient"
import { decodeQueryResult } from "../../../utils/near"

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
  const response = await nearClient.query({
    request_type: "call_function",
    account_id: config.env.contractID,
    method_name: "fee",
    args_base64: btoa(JSON.stringify({})),
    finality: "optimistic",
  })

  // in bip: 1 bip = 0.0001% = 0.000001
  return decodeQueryResult(response, v.number())
}
