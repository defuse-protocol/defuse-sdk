import { beforeEach, describe, expect, it } from "vitest"
import type { ActorRefFrom } from "xstate"
import type { Intent } from "../features/machines/intentPoolMachine"
import type { intentStatusMachine } from "../features/machines/intentStatusMachine"
import { getPendingDeltaBalances } from "./pool"

type MockIntent = {
  quoteToPublish: {
    tokenDeltas: [string, bigint][]
  }
  slippageBasisPoints: number
  intentDescription: {
    type: "swap" | "withdraw"
  }
}

class MockIntentRef {
  state: keyof typeof intentStatusMachine.states
  id: string
  constructor(id: string) {
    this.state = "pending"
    this.id = id
  }
  getSnapshot() {
    return {
      value: this.state,
      id: this.id,
    }
  }
  setState(updateState: keyof typeof intentStatusMachine.states) {
    this.state = updateState
  }
}

describe("pool", () => {
  let defaultIntentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  let defaultPool: Map<string, Intent>

  const intent1: MockIntent = {
    quoteToPublish: {
      tokenDeltas: [
        ["NEAR", -100000000000000000000000n],
        ["USDT", 500000n],
      ],
    },
    slippageBasisPoints: 0,
    intentDescription: {
      type: "swap",
    },
  }

  const intent2: MockIntent = {
    quoteToPublish: {
      tokenDeltas: [
        ["USDT", -500000n],
        ["BTC", 10000n],
      ],
    },
    slippageBasisPoints: 0,
    intentDescription: {
      type: "swap",
    },
  }

  beforeEach(() => {
    defaultIntentRefs = [
      new MockIntentRef("intent-1"),
      new MockIntentRef("intent-2"),
    ] as unknown as ActorRefFrom<typeof intentStatusMachine>[]
    defaultPool = new Map([
      ["intent-1", intent1],
      ["intent-2", intent2],
    ]) as unknown as Map<string, Intent>
  })

  it("should return the correct pending delta balances", () => {
    const intentRefs = defaultIntentRefs
    const pool = defaultPool

    const pendingDeltaBalances = getPendingDeltaBalances(intentRefs, pool)

    expect(pendingDeltaBalances).toEqual({
      NEAR: -100000000000000000000000n,
      USDT: 0n,
      BTC: 10000n,
    })
  })

  it("should return the correct pending delta balances with slippage", () => {
    let intentRefs = defaultIntentRefs
    const pool = defaultPool

    const intent3: MockIntent = {
      quoteToPublish: {
        tokenDeltas: [
          ["BTC", -10000n],
          ["SOL", 500000000n],
        ],
      },
      slippageBasisPoints: 100,
      intentDescription: {
        type: "swap",
      },
    }
    const intent4: MockIntent = {
      quoteToPublish: {
        tokenDeltas: [
          ["SOL", -495000000n],
          ["ETH", 35739265171677557n],
        ],
      },
      slippageBasisPoints: 100,
      intentDescription: {
        type: "swap",
      },
    }

    intentRefs = [
      ...intentRefs,
      new MockIntentRef("intent-3") as unknown as ActorRefFrom<
        typeof intentStatusMachine
      >,
      new MockIntentRef("intent-4") as unknown as ActorRefFrom<
        typeof intentStatusMachine
      >,
    ]
    defaultPool.set("intent-3", intent3 as unknown as Intent)
    defaultPool.set("intent-4", intent4 as unknown as Intent)

    const pendingDeltaBalances = getPendingDeltaBalances(intentRefs, pool)

    expect(pendingDeltaBalances).toEqual({
      NEAR: -100000000000000000000000n,
      USDT: 0n,
      BTC: 0n,
      SOL: 0n,
      ETH: 35381872519960782n,
    })
  })
})
