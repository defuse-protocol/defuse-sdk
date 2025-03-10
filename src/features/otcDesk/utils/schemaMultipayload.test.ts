import { base64 } from "@scure/base"
import { Keypair } from "@solana/web3.js"
import nacl from "tweetnacl"
import * as v from "valibot"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import {
  createEmptyIntentMessage,
  createSwapIntentMessage,
  createWithdrawIntentMessage,
} from "../../../core/messages"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { WalletMessage } from "../../../types/swap"
import {
  GeneralPayloadObjectSchema,
  MultiPayloadDeepSchema,
} from "./schemaMultipayload"

describe("mulltipayload schemas", async () => {
  it.each([
    await signERC191(genSwapIntent),
    await signRawED25519(genSwapIntent),
    await signRawED25519(genWithdrawIntent),
    await signERC191(genWithdrawIntent),
    await signRawED25519(genEmptyIntent),
    await signERC191(genEmptyIntent),
  ])("should parse multipayload", (multipayload) => {
    expect(() => v.parse(MultiPayloadDeepSchema, multipayload)).not.toThrow()
  })
})

describe("PayloadObjectSchema", () => {
  const signer1: SignerCredentials = {
    credential: "user.near",
    credentialType: "near",
  }

  it.each([
    ["incorrect nonce", "Invalid base64 encoding"],
    [
      base64.encode(crypto.getRandomValues(new Uint8Array(64))),
      "Invalid length (32 bytes expected)",
    ],
  ])("incorrect nonce", async (invalidNonce, err) => {
    const walletMessage = genSwapIntent(signer1)
    const payloadObj = JSON.parse(walletMessage.ERC191.message)

    expect(() =>
      v.parse(GeneralPayloadObjectSchema, {
        ...payloadObj,
        nonce: invalidNonce,
      })
    ).toThrow(err)
  })

  it("incorrect signer_id", async () => {
    const walletMessage = genSwapIntent(signer1)
    const payloadObj = JSON.parse(walletMessage.ERC191.message)

    expect(() =>
      v.parse(GeneralPayloadObjectSchema, {
        ...payloadObj,
        signer_id: "invalid-signer-",
      })
    ).toThrow('Invalid input: Received "invalid-signer-"')
  })

  it("incorrect verifying_contract", () => {
    const walletMessage = genSwapIntent(signer1)
    const payloadObj = JSON.parse(walletMessage.ERC191.message)

    expect(() =>
      v.parse(GeneralPayloadObjectSchema, {
        ...payloadObj,
        verifying_contract: "invalid-contract-name-",
      })
    ).toThrow('Invalid input: Received "invalid-contract-name-"')
  })
})

function genSwapIntent(signerId: SignerCredentials) {
  return createSwapIntentMessage([["nep141:token1", 3n]], { signerId })
}

function genEmptyIntent(signerId: SignerCredentials) {
  return createEmptyIntentMessage({ signerId })
}

function genWithdrawIntent(signerId: SignerCredentials) {
  return createWithdrawIntentMessage(
    {
      type: "to_near",
      amount: 100n,
      tokenAccountId: "wrap.near",
      receiverId: "user.near",
      storageDeposit: 150000000000n,
    },
    { signerId }
  )
}

type FakeSign = (
  walletMessageFactory: (signerCreds: SignerCredentials) => WalletMessage
) => Promise<MultiPayload>

const signERC191: FakeSign = async (walletMessageFactory) => {
  const signer = privateKeyToAccount(generatePrivateKey())
  const signerCreds: SignerCredentials = {
    credential: signer.address,
    credentialType: "evm",
  }

  const walletMessage = walletMessageFactory(signerCreds)

  return formatSignedIntent(
    {
      type: "ERC191",
      signatureData: await signer.signMessage(walletMessage.ERC191),
      signedData: walletMessage.ERC191,
    },
    signerCreds
  )
}

const signRawED25519: FakeSign = async (walletMessageFactory) => {
  const keypair = Keypair.generate()
  const signerCreds: SignerCredentials = {
    credential: keypair.publicKey.toBase58(),
    credentialType: "solana",
  }

  const walletMessage = walletMessageFactory(signerCreds)

  return formatSignedIntent(
    {
      type: "SOLANA",
      signatureData: nacl.sign.detached(
        walletMessage.SOLANA.message,
        keypair.secretKey
      ),
      signedData: walletMessage.SOLANA,
    },
    signerCreds
  )
}
