import { describe, expect, it } from "vitest"
import type {
  ERC191SignatureData,
  NEP413SignatureData,
  SolanaSignatureData,
  WalletMessage,
} from "../types/swap"
import { prepareSwapSignedData } from "./prepareBroadcastRequest"

describe("prepareSwapSignedData()", () => {
  const walletMessage: WalletMessage = {
    NEP413: {
      message: `{"foo":"bar"}`,
      recipient: "defuse.near",
      nonce: Buffer.from(
        "esXbbxyJNApGznX1v8kT5ojuat7jqUv84Ib+Q6hWdzI=",
        "base64"
      ),
    },
    ERC191: {
      message: JSON.stringify({ foo: "bar" }),
    },
    SOLANA: {
      message: Uint8Array.from(
        Buffer.from(JSON.stringify({ foo: "bar" }), "utf8")
      ),
    },
  }

  it("should return the correct signed data for a NEP141 signature", () => {
    const signature: NEP413SignatureData = {
      type: "NEP413",
      signatureData: {
        accountId: "user.near",
        publicKey: "ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga",
        signature: "stH6JnShG+GwWCsfN9iu/m4un6qwYLN9Df+5oQYsL7Q=",
      },
      signedData: walletMessage.NEP413,
    }

    expect(
      prepareSwapSignedData(signature, {
        userAddress: "user.near",
        userChainType: "near",
      })
    ).toMatchSnapshot()
  })

  it("should return the correct signed data for an ERC191 signature", () => {
    const signature: ERC191SignatureData = {
      type: "ERC191",
      signatureData: "0xdeadbeef1c",
      signedData: walletMessage.ERC191,
    }

    expect(
      prepareSwapSignedData(signature, {
        userAddress: "0xabcd",
        userChainType: "evm",
      })
    ).toMatchSnapshot()
  })

  it("should return the correct signed data for a Solana signature", () => {
    const signature: SolanaSignatureData = {
      type: "SOLANA",
      signatureData: Buffer.from("deadbeef1c", "hex"),
      signedData: walletMessage.SOLANA,
    }

    expect(
      prepareSwapSignedData(signature, {
        userAddress: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
        userChainType: "solana",
      })
    ).toMatchSnapshot()
  })
})
