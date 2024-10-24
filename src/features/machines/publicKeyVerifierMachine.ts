import type { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import { fromPromise } from "xstate"
import { settings } from "../../config/settings"
import type { Transaction } from "../../types/deposit"

export type SendNearTransaction = (
  tx: Transaction
) => Promise<{ txHash: string } | null>

export const publicKeyVerifierMachine = fromPromise(
  async ({
    input: { nearAccount, nearClient, sendNearTransaction },
  }: {
    input: {
      nearAccount: { accountId: string; publicKey: string } | null
      nearClient: providers.Provider
      sendNearTransaction: SendNearTransaction
    }
  }): Promise<boolean> => {
    // Don't need to verify public key if it is not Near account,
    // because public key cannot change for non-Near accounts.
    if (nearAccount == null) {
      return true
    }
    return verifyPublicKey({ nearAccount, nearClient, sendNearTransaction })
  }
)

async function verifyPublicKey({
  nearAccount,
  nearClient,
  sendNearTransaction,
}: {
  nearClient: providers.Provider
  nearAccount: { accountId: string; publicKey: string }
  sendNearTransaction: SendNearTransaction
}): Promise<boolean> {
  let pubKeyIsOnchain: boolean
  try {
    pubKeyIsOnchain = await checkPublicKeyOnchain({ nearAccount, nearClient })
  } catch (err: unknown) {
    throw new Error("Error checking public key onchain", { cause: err })
  }

  if (pubKeyIsOnchain) {
    return true
  }

  try {
    return await addPublicKeyToContract({
      pubKey: nearAccount.publicKey,
      sendNearTransaction,
    })
  } catch (err: unknown) {
    throw new Error("Error adding public key to contract", { cause: err })
  }
}

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
