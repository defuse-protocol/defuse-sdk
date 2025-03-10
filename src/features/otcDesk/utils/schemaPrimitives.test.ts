import { base58, hex } from "@scure/base"
import { Keypair } from "@solana/web3.js"
import nacl from "tweetnacl"
import * as v from "valibot"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"
import { transformERC191Signature } from "../../../utils/prepareBroadcastRequest"
import {
  PublicKeyED25519Schema,
  SignatureED25519Schema,
  SignatureSecp256k1Schema,
} from "./schemaPrimitives"

describe("PublicKeyED25519Schema", () => {
  it("valid public key", () => {
    const keypair = Keypair.generate()
    const publicKey = `ed25519:${keypair.publicKey.toBase58()}`
    expect(() => v.parse(PublicKeyED25519Schema, publicKey)).not.toThrow()
  })

  it("invalid public key", () => {
    const keypair = Keypair.generate()
    expect(() => v.parse(PublicKeyED25519Schema, "ed25519:foo")).toThrow()
    expect(() =>
      v.parse(PublicKeyED25519Schema, keypair.publicKey.toBase58())
    ).toThrow()
  })
})

describe("SignatureED25519Schema", () => {
  it("valid signature", () => {
    const keypair = Keypair.generate()
    const signature = nacl.sign.detached(new Uint8Array(32), keypair.secretKey)
    const formatted = `ed25519:${base58.encode(signature)}`
    expect(() => v.parse(SignatureED25519Schema, formatted)).not.toThrow()
  })

  it("invalid signature", () => {
    const keypair = Keypair.generate()
    const signature = nacl.sign.detached(new Uint8Array(32), keypair.secretKey)

    const formatted1 = "ed25519:foo"
    const formatted2 = base58.encode(signature)
    // Malleable signature
    const formatted3 = `ed25519:${base58.encode(hex.decode("01c42949178201fd9bcddff0415d4f0323431e1d02ed71d09a98882cb2bf3a4daef1075c0c4d06e9879fef30169e107677e31efe2e653e00deefa11527df9b2c"))}`

    expect(() => v.parse(SignatureED25519Schema, formatted1)).toThrow()
    expect(() => v.parse(SignatureED25519Schema, formatted2)).toThrow()
    expect(() => v.parse(SignatureED25519Schema, formatted3)).toThrow(
      "Signature malleability issue (S byte must be low)"
    )
  })
})

describe("SignatureSecp256k1Schema", () => {
  it("valid signature", async () => {
    const signer = privateKeyToAccount(generatePrivateKey())
    const formatted = transformERC191Signature(
      await signer.signMessage({ message: "0x" })
    )
    expect(() => v.parse(SignatureSecp256k1Schema, formatted)).not.toThrow()
  })

  it("invalid signature", async () => {
    const signer = privateKeyToAccount(generatePrivateKey())
    const hexSignature = await signer.signMessage({ message: "0x" })
    const signature = hex.decode(hexSignature.slice(2))

    const formatted1 = "secp256k1:foo"
    const formatted2 = base58.encode(signature)

    const invalidRecoveryBit = Uint8Array.from(signature)
    invalidRecoveryBit[invalidRecoveryBit.length - 1] = 27
    const formatted3 = `secp256k1:${base58.encode(invalidRecoveryBit)}`

    expect(() => v.parse(SignatureSecp256k1Schema, formatted1)).toThrow()
    expect(() => v.parse(SignatureSecp256k1Schema, formatted2)).toThrow()
    expect(() => v.parse(SignatureSecp256k1Schema, formatted3)).toThrow()
  })
})
