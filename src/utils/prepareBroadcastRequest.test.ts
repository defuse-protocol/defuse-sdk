import { describe, expect, it } from "vitest"
import type {
  ERC191SignatureData,
  NEP413SignatureData,
  WalletMessage,
} from "../types"
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

    expect(prepareSwapSignedData(signature)).toMatchSnapshot()
  })

  it("should return the correct signed data for an ERC191 signature", () => {
    const signature: ERC191SignatureData = {
      type: "ERC191",
      signatureData: "0xdeadbeef1c",
      signedData: walletMessage.ERC191,
    }

    expect(prepareSwapSignedData(signature)).toMatchSnapshot()
  })
})
