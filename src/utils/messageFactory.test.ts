import { describe, expect, it } from "vitest"
import { makeInnerSwapMessage, makeSwapMessage } from "./messageFactory"

describe("makeSwapMessage()", () => {
  const innerMessage = makeInnerSwapMessage({
    tokenDiff: [["foo.near", 100n]],
    signerId: "user.near",
    deadlineTimestamp: 1000000,
  })

  it("should return a WalletMessage object", () => {
    const message = makeSwapMessage({
      innerMessage,
      recipient: "recipient.near",
      nonce: new Uint8Array(32),
    })

    expect(message).toEqual({
      NEP413: {
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
      innerMessage,
      recipient: "recipient.near",
    })

    const msg2 = makeSwapMessage({
      innerMessage,
      recipient: "recipient.near",
    })

    expect(msg1.NEP413.nonce).not.toEqual(msg2.NEP413.nonce)
  })
})
