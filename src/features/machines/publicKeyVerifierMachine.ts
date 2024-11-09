import type { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import { assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import type { Transaction } from "../../types/deposit"

export type SendNearTransaction = (
  tx: Transaction
) => Promise<{ txHash: string } | null>

type Input = {
  nearAccount: { accountId: string; publicKey: string } | null
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
}

type Output = boolean

type Context = Input & {
  error: string | null
}

export const publicKeyVerifierMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
    children: {},
  },
  actors: {
    checkPubKeyActor: fromPromise(
      ({ input }: { input: Parameters<typeof checkPublicKeyOnchain>[0] }) => {
        return checkPublicKeyOnchain(input)
      }
    ),
    addPubKeyActor: fromPromise(
      ({ input }: { input: Parameters<typeof addPublicKeyToContract>[0] }) => {
        return addPublicKeyToContract(input)
      }
    ),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAcCuAjANgSwMYGkwBPANTACdsAzbCgOmwkzAGIBtABgF1EUB7WNgAu2PgDteIAB6IAjACYArHQBsigBybZK+QE5dHWQGZ5AGhBFE62XRN7tugOwAWWbsWKVAXy-m0WPEJSCmpacgYmVjZZHiQQZAFhUQk4mQQFZTVNax19QxNzSwR5dSM6DgNdayNnZxLPHz8MHAJiMkoaelwACzBcAGtsMSgWCHEwBjEANz5+iZ6+-oAFDCCAJTAqTlj+QRFxSTSVdXly40NtFRd1WsLEPVPHDgr1FWc1N0UjRvjmwLaQp1wgsBkMRmMxBMhjM5nQQctVsQNlsYpIEntkodEJ5HipdLInrp5G4bs47ggjNZbESCSZtDVHIofv4WkF2qEur1QcMWBRyHxwshMABDIRUAUAWzhXIR6HWm22aMS+xSoDSsg4RmUJKMul1RjxzgN5KUKlUeI47y1VUMjkczL+rWCHTC0sWkBYAEEACLegD6SwAqgAhAAyAEkAMJ+-AAUQAmoq4uikgdUohHLIbCpddpHKUOEpdCpyYo3HRjOpFCUOFdHFqHQEneygXRhRAIGDRuNJjCJu2ICs5UiFdwlRi02q5EZZJkZ4yrcd3Ipyc5XnR3O9nJrnHaFN9fL8m2zAa6B12IVDprN+x2h-KUTt4srMen0ios+V3PInnpM0SyQsRAtzoeQjGeIx-xqWR1F0RtWQBF16HPHk+QFOghVFcVyClAd7xHLYx2TF9J2kOQ3jNPVKT0HNrAqRxyRMZw6FePUdCuAxMxqHxDzEPgIDgNFHRPJDyHHVNVTIhAAFoSyAmTlH0fR1EcFQrg4etTXg-5nQ5cJGGYcSVSxBA6nJKtVC+eRa11fM8mcbTm1PTlFjBIzXynYoVLoRxdDqFSKg8azVJNRRHDoRR8Q-Cp1P0bxDxZHSW1deFIHc0i0i+M1YOcL4FDeSDZFLGCWNratng1d5q0ckS9LbDs3OIidJLSJx1FA2DnieRRnicXRV3cakCTxNQ9Ss+KmmPRC6twPgJSFMAhDSpqJJMy52pONiTBcDSXHJPy6FcbcNCULNiTtHivCAA */
  id: "publicKeyVerifier",
  initial: "idle",
  context: ({ input }) => {
    return {
      ...input,
      error: null,
    }
  },
  output: ({ context }) => {
    return context.error == null
  },
  states: {
    idle: {
      always: [
        {
          target: "completed",
          guard: ({ context }) => {
            // Don't need to check public key if it is not Near account,
            // because public key cannot change for non-Near accounts.
            return context.nearAccount == null
          },
        },
        {
          target: "checking",
        },
      ],
    },

    checking: {
      invoke: {
        id: "checkPubKeyRef",
        src: "checkPubKeyActor",
        input: ({ context }) => {
          if (context.nearAccount == null) {
            throw new Error("no near account")
          }

          return {
            nearAccount: context.nearAccount,
            nearClient: context.nearClient,
            sendNearTransaction: context.sendNearTransaction,
          }
        },
        onDone: [
          {
            target: "completed",
            guard: ({ event }) => event.output,
          },
          {
            target: "checked",
          },
        ],
        onError: {
          target: "completed",
          actions: [
            ({ event }) => console.error("Failed to check pubKey", event.error),
            assign({
              error: "FAILED_CHECK_PUBKEY",
            }),
          ],
        },
      },
    },

    checked: {
      on: {
        ADD_PUBLIC_KEY: {
          target: "adding",
        },
        ABORT_ADD_PUBLIC_KEY: {
          target: "completed",
          actions: assign({ error: "ABORTED_ADD_PUBKEY" }),
        },
      },
    },

    adding: {
      invoke: {
        id: "addPubKeyRef",
        src: "addPubKeyActor",
        input: ({ context }) => {
          if (context.nearAccount == null) {
            throw new Error("no near account")
          }

          return {
            pubKey: context.nearAccount.publicKey,
            sendNearTransaction: context.sendNearTransaction,
          }
        },
        onDone: [
          { target: "completed", guard: ({ event }) => event.output != null },
          {
            target: "completed",
            actions: assign({ error: "DIDNT_ADD_PUBKEY" }),
          },
        ],
        onError: {
          target: "completed",
          actions: [
            ({ event }) => console.error("Failed to add pubKey", event.error),
            assign({
              error: "FAILED_ADD_PUBKEY",
            }),
          ],
        },
      },
    },

    completed: {
      type: "final",
    },
  },
})

async function checkPublicKeyOnchain({
  nearAccount,
  nearClient,
}: {
  nearClient: providers.Provider
  nearAccount: { accountId: string; publicKey: string }
}): Promise<boolean> {
  const output = await nearClient.query<CodeResult>({
    request_type: "call_function",
    account_id: settings.defuseContractId,
    method_name: "has_public_key",
    args_base64: btoa(
      JSON.stringify({
        account_id: nearAccount.accountId,
        public_key: nearAccount.publicKey,
      })
    ),
    finality: "optimistic",
  })

  const stringData = String.fromCharCode(...output.result)
  const value = JSON.parse(stringData)
  if (typeof value !== "boolean") {
    throw new Error("Unexpected response from has_public_key")
  }

  return value
}

async function addPublicKeyToContract({
  pubKey,
  sendNearTransaction,
}: {
  pubKey: string
  sendNearTransaction: SendNearTransaction
}): Promise<boolean> {
  const tx: Transaction = {
    receiverId: settings.defuseContractId,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: "add_public_key",
          args: { public_key: pubKey },
          gas: "300000000000000",
          deposit: "1",
        },
      },
    ],
  }
  return (await sendNearTransaction(tx)) != null
}