import { describe, expect, it } from "vitest"
import { userAddressToDefuseUserId } from "./defuse"
import {
  makeInnerSwapAndWithdrawMessage,
  makeInnerSwapMessage,
  makeSwapMessage,
} from "./messageFactory"

describe("makeSwapMessage()", () => {
  const innerMessage = makeInnerSwapMessage({
    tokenDeltas: [["foo.near", 100n]],
    signerId: userAddressToDefuseUserId("user.near", "near"),
    deadlineTimestamp: 1704110400000, // 2024-01-01T12:00:00.000Z
  })

  it("should return a WalletMessage object", () => {
    const message = makeSwapMessage({
      innerMessage,
      recipient: "recipient.near",
      nonce: new Uint8Array(32),
    })

    expect(message).toEqual({
      NEP413: {
        message: `{"deadline":"2024-01-01T12:00:00.000Z","intents":[{"intent":"token_diff","diff":{"foo.near":"100"}}],"signer_id":"user.near"}`,
        recipient: "recipient.near",
        nonce: new Uint8Array(32),
      },
      ERC191: {
        message: `{
  "signer_id": "user.near",
  "verifying_contract": "intents.near",
  "deadline": "2024-01-01T12:00:00.000Z",
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
      SOLANA: {
        message: Uint8Array.from(
          Buffer.from(
            JSON.stringify({
              signer_id: "user.near",
              verifying_contract: "intents.near",
              deadline: "2024-01-01T12:00:00.000Z",
              nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
              intents: [{ intent: "token_diff", diff: { "foo.near": "100" } }],
            }),
            "utf-8"
          )
        ),
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

  it("should include referral in token_diff intent", () => {
    const innerMessage = makeInnerSwapMessage({
      tokenDeltas: [
        ["foo.near", -100n],
        ["bar.near", 200n],
      ],
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: 1704110400000,
      referral: "referrer.near",
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "diff": {
              "bar.near": "200",
              "foo.near": "-100",
            },
            "intent": "token_diff",
            "referral": "referrer.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("should merge amounts in/out with same token", () => {
    const innerMessage = makeInnerSwapMessage({
      tokenDeltas: [
        ["foo.near", -150n],
        ["bar.near", -200n],
        ["bar.near", 270n],
        ["foo.near", 100n],
      ],
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: 1704110400000,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "diff": {
              "bar.near": "70",
              "foo.near": "-50",
            },
            "intent": "token_diff",
            "referral": undefined,
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })
})

describe("makeInnerSwapAndWithdrawMessage()", () => {
  const DEADLINE = 1704110400000 // 2024-01-01T12:00:00.000Z

  it("generates message with swaps", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      tokenDeltas: [
        ["foo.near", -100n],
        ["bar.near", 200n],
      ],
      withdrawParams: {
        type: "to_near",
        amount: 200n,
        tokenAccountId: "bar.near",
        receiverId: "receiver.near",
        storageDeposit: 0n,
      },
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: DEADLINE,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "diff": {
              "bar.near": "200",
              "foo.near": "-100",
            },
            "intent": "token_diff",
            "referral": undefined,
          },
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "receiver_id": "receiver.near",
            "storage_deposit": undefined,
            "token": "bar.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("generates message without swaps", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      tokenDeltas: null,
      withdrawParams: {
        type: "to_near",
        amount: 200n,
        tokenAccountId: "bar.near",
        receiverId: "receiver.near",
        storageDeposit: 100n,
      },
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: DEADLINE,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "receiver_id": "receiver.near",
            "storage_deposit": "100",
            "token": "bar.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("generates message for withdrawing via POA Bridge", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      tokenDeltas: null,
      withdrawParams: {
        type: "via_poa_bridge",
        amount: 200n,
        tokenAccountId: "bar-poa-bridge-token.near",
        destinationAddress: "0xdead",
        destinationMemo: null,
      },
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: DEADLINE,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
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

  it("generates message for withdrawing via POA Bridge to XRP Ledger", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      tokenDeltas: null,
      withdrawParams: {
        type: "via_poa_bridge",
        amount: 200n,
        tokenAccountId: "xrp.omft.near",
        destinationAddress: "rJHkpNJVRUKMGV3NV6FNccySKNwEFF9C4c",
        destinationMemo: "2682497019",
      },
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: DEADLINE,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "memo": "WITHDRAW_TO:rJHkpNJVRUKMGV3NV6FNccySKNwEFF9C4c:2682497019",
            "receiver_id": "xrp.omft.near",
            "token": "xrp.omft.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("generates message for withdrawing to AuroraEngine powered blockchains", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      tokenDeltas: null,
      withdrawParams: {
        type: "to_aurora_engine",
        amount: 200n,
        tokenAccountId: "usdt.near",
        auroraEngineContractId: "foo.cloud.aurora",
        destinationAddress: "0xDeAdBeEf00000000000000000000000000000001",
      },
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: DEADLINE,
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "msg": "deadbeef00000000000000000000000000000001",
            "receiver_id": "foo.cloud.aurora",
            "token": "usdt.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })

  it("should include referral in token_diff intent when swapping and withdrawing", () => {
    const innerMessage = makeInnerSwapAndWithdrawMessage({
      tokenDeltas: [
        ["foo.near", -100n],
        ["bar.near", 200n],
      ],
      withdrawParams: {
        type: "to_near",
        amount: 200n,
        tokenAccountId: "bar.near",
        receiverId: "receiver.near",
        storageDeposit: 0n,
      },
      signerId: userAddressToDefuseUserId("user.near", "near"),
      deadlineTimestamp: DEADLINE,
      referral: "referrer.near",
    })

    expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "diff": {
              "bar.near": "200",
              "foo.near": "-100",
            },
            "intent": "token_diff",
            "referral": "referrer.near",
          },
          {
            "amount": "200",
            "intent": "ft_withdraw",
            "receiver_id": "receiver.near",
            "storage_deposit": undefined,
            "token": "bar.near",
          },
        ],
        "signer_id": "user.near",
      }
    `)
  })
})
