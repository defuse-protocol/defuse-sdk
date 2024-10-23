import { describe, expect, it } from "vitest"
import type { NEP413SignatureData, WalletMessage } from "../types"
import { prepareSwapSignedData } from "./prepareBroadcastRequest"

describe("prepareSwapSignedData()", () => {
  it("should return the correct signed data for a NEP141 signature", () => {
    const walletMessage: WalletMessage = {
      NEP413: {
        message: `{"foo":"bar"}`,
        recipient: "defuse.near",
        nonce: Buffer.from(
          "esXbbxyJNApGznX1v8kT5ojuat7jqUv84Ib+Q6hWdzI=",
          "base64"
        ),
      },
      EIP712: {
        json: "{}",
      },
    }

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
})
