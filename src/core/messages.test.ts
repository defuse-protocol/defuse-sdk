import { describe, expect, it } from "vitest"
import { userAddressToDefuseUserId } from "../utils/defuse"
import {
  createEmptyIntentMessage,
  createSwapIntentMessage,
  createWithdrawIntentMessage,
} from "./messages"

const TEST_TIMESTAMP = 1704110400000 // 2024-01-01T12:00:00.000Z
const TEST_USER = userAddressToDefuseUserId("user.near", "near")

describe("createSwapIntentMessage()", () => {
  it("creates a valid swap intent message", () => {
    const message = createSwapIntentMessage(
      [
        ["token.near", -100n],
        ["usdc.near", 50n],
      ],
      {
        signerId: TEST_USER,
        deadlineTimestamp: TEST_TIMESTAMP,
      }
    )

    expect(JSON.parse(message.NEP413.message)).toEqual({
      deadline: "2024-01-01T12:00:00.000Z",
      intents: [
        {
          intent: "token_diff",
          diff: {
            "token.near": "-100",
            "usdc.near": "50",
          },
        },
      ],
      signer_id: "user.near",
    })
  })
})

describe("createWithdrawIntentMessage()", () => {
  it("creates a valid withdraw intent message", () => {
    const message = createWithdrawIntentMessage(
      {
        type: "to_near",
        amount: 100n,
        tokenAccountId: "token.near",
        receiverId: "receiver.near",
        storageDeposit: 0n,
      },
      {
        signerId: TEST_USER,
        deadlineTimestamp: TEST_TIMESTAMP,
      }
    )

    expect(JSON.parse(message.NEP413.message)).toEqual({
      deadline: "2024-01-01T12:00:00.000Z",
      intents: [
        {
          intent: "ft_withdraw",
          token: "token.near",
          receiver_id: "receiver.near",
          amount: "100",
        },
      ],
      signer_id: "user.near",
    })
  })
})

describe("createEmptyIntentMessage()", () => {
  it("creates a valid empty intent message", () => {
    const message = createEmptyIntentMessage({
      signerId: TEST_USER,
      deadlineTimestamp: TEST_TIMESTAMP,
    })

    expect(JSON.parse(message.NEP413.message)).toEqual({
      deadline: "2024-01-01T12:00:00.000Z",
      intents: [],
      signer_id: "user.near",
    })
  })

  it("uses default deadline when not provided", () => {
    const message = createEmptyIntentMessage({
      signerId: TEST_USER,
    })

    const parsed = JSON.parse(message.NEP413.message)
    expect(Date.parse(parsed.deadline)).toBeGreaterThan(Date.now())
    expect(parsed.intents).toEqual([])
  })
})
