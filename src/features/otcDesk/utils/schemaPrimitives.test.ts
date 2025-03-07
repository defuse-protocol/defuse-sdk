import { base58 } from "@scure/base"
import { Keypair } from "@solana/web3.js"
import nacl from "tweetnacl"
import * as v from "valibot"
import { describe, expect, it } from "vitest"
import {
  PublicKeyED25519Schema,
  SignatureED25519Schema,
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
    expect(() => v.parse(SignatureED25519Schema, formatted1)).toThrow()
    expect(() => v.parse(SignatureED25519Schema, formatted2)).toThrow()
  })
})
