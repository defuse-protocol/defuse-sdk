import { base58, hex } from "@scure/base"
import { Keypair } from "@solana/web3.js"
import nacl from "tweetnacl"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"
import { transformERC191Signature } from "../../../utils/prepareBroadcastRequest"
import { normalizeSignatureS } from "../../../utils/webAuthn"
import {
  PublicKeyED25519Schema,
  SignatureED25519Schema,
  SignatureP256Schema,
  SignatureSecp256k1Schema,
} from "./schemaPrimitives"

describe("PublicKeyED25519Schema", () => {
  it("valid public key", () => {
    const keypair = Keypair.generate()
    const publicKey = `ed25519:${keypair.publicKey.toBase58()}`
    expect(() => PublicKeyED25519Schema.parse(publicKey)).not.toThrow()
  })

  it("invalid public key", () => {
    const keypair = Keypair.generate()
    expect(() => PublicKeyED25519Schema.parse("ed25519:foo")).toThrow()
    expect(() =>
      PublicKeyED25519Schema.parse(keypair.publicKey.toBase58())
    ).toThrow()
  })
})

describe("SignatureED25519Schema", () => {
  it("valid signature", () => {
    const keypair = Keypair.generate()

    let signature = nacl.sign.detached(new Uint8Array(32), keypair.secretKey)
    const sBytes = signature.slice(32, 64)
    const sBytesNormalized = normalizeSignatureS(sBytes)
    signature = new Uint8Array([...signature.slice(0, 32), ...sBytesNormalized])

    const formatted = `ed25519:${base58.encode(signature)}`
    expect(() => SignatureED25519Schema.parse(formatted)).not.toThrow()
  })

  it("invalid signature", () => {
    const keypair = Keypair.generate()
    const signature = nacl.sign.detached(new Uint8Array(32), keypair.secretKey)

    const formatted1 = "ed25519:foo"
    const formatted2 = base58.encode(signature)

    expect(() => SignatureED25519Schema.parse(formatted1)).toThrow()
    expect(() => SignatureED25519Schema.parse(formatted2)).toThrow()
  })
})

describe("SignatureSecp256k1Schema", () => {
  it("valid signature", async () => {
    const signer = privateKeyToAccount(generatePrivateKey())
    const formatted = transformERC191Signature(
      await signer.signMessage({ message: "0x" })
    )
    expect(() => SignatureSecp256k1Schema.parse(formatted)).not.toThrow()
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

    expect(() => SignatureSecp256k1Schema.parse(formatted1)).toThrow()
    expect(() => SignatureSecp256k1Schema.parse(formatted2)).toThrow()
    expect(() => SignatureSecp256k1Schema.parse(formatted3)).toThrow()
  })
})

describe("SignatureP256Schema", () => {
  it("valid signature", async () => {
    const keypair = await generateP256KeyPair()
    const signature = await signP256(new Uint8Array(32), keypair.privateKey)

    const formatted = `p256:${base58.encode(signature)}`
    expect(() => SignatureP256Schema.parse(formatted)).not.toThrow()
  })

  it("invalid signature", async () => {
    const keypair = await generateP256KeyPair()
    const signature = await signP256(new Uint8Array(32), keypair.privateKey)

    const formatted1 = "p256:foo"
    const formatted2 = base58.encode(signature)
    // Malleable signature
    const formatted3 = `p256:${base58.encode(hex.decode("01c42949178201fd9bcddff0415d4f0323431e1d02ed71d09a98882cb2bf3a4daef1075c0c4d06e9879fef30169e107677e31efe2e653e00deefa11527df9b2c"))}`

    expect(() => SignatureP256Schema.parse(formatted1)).toThrow()
    expect(() => SignatureP256Schema.parse(formatted2)).toThrow()
    expect(() => SignatureP256Schema.parse(formatted3)).toThrow(
      "Signature malleability issue (S byte must be low)"
    )
  })

  function generateP256KeyPair() {
    return globalThis.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    )
  }

  function signP256(message: Uint8Array, privateKey: CryptoKey) {
    return globalThis.crypto.subtle
      .sign({ name: "ECDSA", hash: { name: "SHA-256" } }, privateKey, message)
      .then((signature) => new Uint8Array(signature))
      .then((signature) => {
        const sBytes = signature.slice(32, 64)
        const sBytesNormalized = normalizeSignatureS(sBytes)
        return new Uint8Array([...signature.slice(0, 32), ...sBytesNormalized])
      })
  }
})
