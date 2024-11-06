import { describe, expect, it } from "vitest"
import { userAddressToDefuseUserId } from "./defuse"
import {
  makeInnerSwapAndWithdrawMessage,
  makeInnerSwapMessage,
  makeSwapMessage,
} from "./messageFactory"

describe("makeSwapMessage()", () => {
  const innerMessage = makeInnerSwapMessage({
    amountsIn: {},
    amountsOut: { "foo.near": 100n },
    signerId: userAddressToDefuseUserId("user.near"),
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
      ERC191: {
        message: `{
  "signer_id": "user.near",
  "verifying_contract": "intents.near",
  "deadline": {
    "timestamp": 1000000
  },
  "nonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  "intents": [
    {
      "intent": "token_diff",
      "diff": {
        "foo.near": "100"
      }
    }
  ]
}`,
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

describe("makeInnerSwapAndWithdrawMessage()", () => {
  it("generates message with swaps", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      swapParams: {
        amountsIn: { "foo.near": 100n },
        amountsOut: { "bar.near": 200n },
      },
      withdrawParams: {
        type: "to_near",
        amount: 200n,
        tokenAccountId: "bar.near",
        receiverId: "receiver.near",
      },
      signerId: userAddressToDefuseUserId("user.near"),
      deadlineTimestamp: 1000000,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": {
          "timestamp": 1000000,
        },
        "intents": [
          {
            "diff": {
              "bar.near": "200",
              "foo.near": "-100",
            },
            "intent": "token_diff",
          },
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "receiver_id": "receiver.near",
            "token": "bar.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("generates message without swaps", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      swapParams: null,
      withdrawParams: {
        type: "to_near",
        amount: 200n,
        tokenAccountId: "bar.near",
        receiverId: "receiver.near",
      },
      signerId: userAddressToDefuseUserId("user.near"),
      deadlineTimestamp: 1000000,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": {
          "timestamp": 1000000,
        },
        "intents": [
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "receiver_id": "receiver.near",
            "token": "bar.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("generates message for withdrawing via POA Bridge", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      swapParams: null,
      withdrawParams: {
        type: "via_poa_bridge",
        amount: 200n,
        tokenAccountId: "bar-poa-bridge-token.near",
        destinationAddress: "0xdead",
      },
      signerId: userAddressToDefuseUserId("user.near"),
      deadlineTimestamp: 1000000,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": {
          "timestamp": 1000000,
        },
        "intents": [
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "memo": "WITHDRAW_TO:0xdead",
            "receiver_id": "bar-poa-bridge-token.near",
            "token": "bar-poa-bridge-token.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })
})
