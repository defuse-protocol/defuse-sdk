import type { intentStatusMachine } from "src/features/machines/intentStatusMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ActorRefFrom } from "xstate"
import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { Events as IntentPoolEvents } from "../features/machines/intentPoolMachine"
import { findExecutableIntentRef } from "./poolService"

class MockIntentRef {
  state: keyof typeof intentStatusMachine.states
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  id: string

  constructor(
    state: keyof typeof intentStatusMachine.states,
    tokenIn: BaseTokenInfo | UnifiedTokenInfo,
    id: string
  ) {
    this.state = state
    this.tokenIn = tokenIn
    this.id = id
  }

  getSnapshot() {
    return {
      value: this.state,
      context: { tokenIn: this.tokenIn },
    }
  }

  setState(updateState: keyof typeof intentStatusMachine.states) {
    this.state = updateState
  }
}

describe("findExecutableIntentRef", () => {
  const mockToken1: BaseTokenInfo = {
    defuseAssetId: "token-1",
    address: "address-1",
    chainId: "1",
    chainIcon: "icon",
    chainName: "eth",
    decimals: 18,
    icon: "icon",
    symbol: "token-1",
    name: "Token 1",
    routes: [],
  }

  // We only need a subset of IntentPoolEvents["params"] for testing:
  // - intentOperationParams.quote.tokenDeltas: Used to check if user has enough balance
  // - intentId: Used to identify the intent in the pool
  // Other fields are not relevant for these test cases
  const mockIntent = {
    intentOperationParams: {
      quote: {
        expirationTime: new Date().toISOString(),
        quoteHashes: ["hash-1"],
        tokenDeltas: [
          ["token-1", -1000n],
          ["token-2", 1000n],
        ],
      },
      tokensIn: [
        {
          defuseAssetId: "token-1",
          address: "address-1",
          chainId: "1",
        },
      ],
      tokenOut: {
        defuseAssetId: "token-2",
        address: "address-2",
        chainId: "1",
        chainIcon: "icon",
        chainName: "eth",
        decimals: 18,
        icon: "icon",
      },
      type: "swap",
    },
  } as unknown as IntentPoolEvents["params"]

  const mockIntentWithLostData = {
    intentOperationParams: {
      quote: {
        expirationTime: new Date().toISOString(),
        quoteHashes: ["hash-1"],
        tokenDeltas: [],
      },
      tokensIn: [],
      tokenOut: {},
      type: "swap",
    },
  } as unknown as IntentPoolEvents["params"]

  const mockPool = new Map<string, IntentPoolEvents["params"]>([
    ["intent-1", mockIntent],
    ["intent-2", mockIntentWithLostData],
  ])

  const mockBalances: BalanceMapping = {
    "token-1": 1000n,
    "token-2": 0n,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return null if intentRefs is empty", () => {
    const result = findExecutableIntentRef([], mockPool, mockBalances)
    expect(result).toBeNull()
  })

  it("should return null if no intents are in 'pending' state", () => {
    const mockIntentRefs = [
      new MockIntentRef("completed", mockToken1, "intent-1"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    expect(mockIntentRefs.length).toBe(1)

    // @ts-ignore we shurely have a intentRef in the array
    const { value } = mockIntentRefs[0].getSnapshot()
    expect(value).toBe("completed")

    const result = findExecutableIntentRef(
      mockIntentRefs,
      mockPool,
      mockBalances
    )
    expect(result).toBeNull()
  })

  it("should return null if onchainBalance is undefined", () => {
    const mockIntentRefs = [
      new MockIntentRef("pending", mockToken1, "intent-1"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    const result = findExecutableIntentRef(mockIntentRefs, mockPool, {})

    expect(result).toBeNull()
  })

  it("should return null if tokenDeltas is undefined or empty", () => {
    const mockIntentRefs = [
      new MockIntentRef("pending", mockToken1, "intent-2"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    const result = findExecutableIntentRef(
      mockIntentRefs,
      mockPool,
      mockBalances
    )
    expect(result).toBeNull()
  })

  it("should return null if amount is undefined", () => {
    const mockIntentRefs = [
      new MockIntentRef("pending", mockToken1, "intent-2"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    const result = findExecutableIntentRef(
      mockIntentRefs,
      mockPool,
      mockBalances
    )
    expect(result).toBeNull()
  })

  it("should return null if all intents are completed", () => {
    const mockIntentRefs = [
      new MockIntentRef("completed", mockToken1, "intent-1"),
      new MockIntentRef("completed", mockToken1, "intent-2"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    const result = findExecutableIntentRef(
      mockIntentRefs,
      mockPool,
      mockBalances
    )
    expect(result).toBeNull()
  })

  it("should return null if onchainBalance.amount is less than amount * -1n", () => {
    const mockIntentRefs = [
      new MockIntentRef("pending", mockToken1, "intent-1"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    const mockBalancesInsufficient = {
      "token-1": 500n,
    }

    const result = findExecutableIntentRef(
      mockIntentRefs,
      mockPool,
      mockBalancesInsufficient
    )
    expect(result).toBeNull()
  })

  it("should return intentRef.id if an intent is executable", () => {
    const mockIntentRefs = [
      new MockIntentRef("pending", mockToken1, "intent-1"),
      new MockIntentRef("failed", mockToken1, "intent-2"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]

    const result = findExecutableIntentRef(
      mockIntentRefs,
      mockPool,
      mockBalances
    )
    expect(result).toBe("intent-1")
  })
})
