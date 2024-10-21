import { describe, expect, it } from "vitest"
import type { NEP141SignatureData, WalletMessage } from "../types"
import { prepareSwapSignedData } from "./prepareBroadcastRequest"

describe("prepareSwapSignedData()", () => {
  it("should return the correct signed data for a NEP141 signature", () => {
    const signature: NEP141SignatureData = {
      type: "NEP141",
      signatureData: {
        accountId: "user.near",
        publicKey: "ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga",
        signature: "stH6JnShG+GwWCsfN9iu/m4un6qwYLN9Df+5oQYsL7Q=",
      },
    }

    const walletMessage: WalletMessage = {
      NEP141: {
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

    expect(prepareSwapSignedData(signature, walletMessage)).toMatchSnapshot()
  })
})
