import { Keypair } from "@solana/web3.js"
import nacl from "tweetnacl"
import * as v from "valibot"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { createSwapIntentMessage } from "../../../core/messages"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { WalletMessage } from "../../../types/swap"
import { MultiPayloadDeepSchema } from "./schemas"

describe("mulltipayload schemas", async () => {
  it.each([await fakeSwapERC191(), await fakeSwapRawED25519()])(
    "should parse multipayload",
    (multipayload) => {
      expect(() => v.parse(MultiPayloadDeepSchema, multipayload)).not.toThrow()
    }
  )
})

function fakeSwapERC191() {
  return signERC191((signerId) =>
    createSwapIntentMessage([["token1", 3n]], { signerId })
  )
}

function fakeSwapRawED25519() {
  return signRawED25519((signerId) =>
    createSwapIntentMessage([["token1", 3n]], { signerId })
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
