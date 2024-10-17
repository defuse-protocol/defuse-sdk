import { describe, expect, it } from "vitest"
import { makeSwapMessage } from "./messageFactory"

describe("makeSwapMessage()", () => {
  it("should return a WalletMessage object", () => {
    const message = makeSwapMessage({
      tokenDiff: [["foo.near", 100n]],
      signerId: "user.near",
      recipient: "recipient.near",
      deadlineTimestamp: 1000000,
      nonce: new Uint8Array(32),
    })

    expect(message).toEqual({
      NEP141: {
        message: `{"deadline":{"timestamp":1000000},"intents":[{"intent":"token_diff","diff":{"foo.near":"100"}}],"signer_id":"user.near"}`,
        recipient: "recipient.near",
        nonce: new Uint8Array(32),
      },
      EIP712: {
        json: "{}",
      },
    })
  })

  it("should return a WalletMessage with random nonce", () => {
    const msg1 = makeSwapMessage({
      tokenDiff: [["foo.near", 100n]],
      signerId: "signerId",
      recipient: "recipient.near",
      deadlineTimestamp: 1000000,
    })

    const msg2 = makeSwapMessage({
      tokenDiff: [["foo.near", 100n]],
      signerId: "signerId",
      recipient: "recipient.near",
      deadlineTimestamp: 1000000,
    })

    expect(msg1.NEP141.nonce).not.toEqual(msg2.NEP141.nonce)
  })
})
