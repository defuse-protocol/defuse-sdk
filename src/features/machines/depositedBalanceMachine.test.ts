import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  type Snapshot,
  type StateValue,
  createActor,
  fromPromise,
  getNextSnapshot,
} from "xstate"
import {
  prepareOptimisticBalanceUpdate,
  properlyCalculateBalanceChanges,
} from "./depositedBalanceMachine"
import {
  type Context,
  depositedBalanceMachine,
} from "./depositedBalanceMachine"
import type { ParentActor } from "./depositedBalanceMachine"

describe("depositedBalanceMachine", () => {
  const defaultActorImpls = {
    fetchBalanceActor: vi.fn(async ({ self }) => {
      self.send({
        type: "UPDATE_BALANCE_SLICE",
        params: {
          balanceSlice: {
            BTC: 0n,
            NEAR: 0n,
            USDT: 0n,
          },
          transitBalances: {
            BTC: 10000n,
            NEAR: 0n,
            USDT: 0n,
          },
        },
      })
      return true
    }),
  }

  const defaultActors = {
    fetchBalanceActor: fromPromise(defaultActorImpls.fetchBalanceActor),
  }

  const defaultParentRef = {
    id: "mockParentActor",
    getSnapshot: () =>
      ({ value: {}, context: {} }) as unknown as Snapshot<unknown>,
  } as ParentActor

  const defaultContext = {
    parentRef: defaultParentRef,
    optimisticBalancesEnabled: true,
    userAccountId: "Alice",
    defuseTokenIds: ["BTC", "NEAR", "USDT"],
  }

  let actors: typeof defaultActors

  function populateMachine() {
    // @ts-expect-error
    return depositedBalanceMachine.provide({ actors })
  }

  function interpret() {
    return createActor(populateMachine(), {
      input: {
        parentRef: defaultParentRef,
        tokenList: [],
      },
    })
  }

  beforeEach(() => {
    actors = { ...defaultActors }
  })

  it.each`
    expectedState                         | event                        | guards  | context
    ${"authenticated.refreshing balance"} | ${"REQUEST_BALANCE_REFRESH"} | ${null} | ${null}
  `(
    'should reach "$expectedState" when the "$event" event occurs',
    ({ expectedState, event, context }) => {
      const machine = populateMachine()

      const actualState = getNextSnapshot(
        machine,
        machine.resolveState({
          value: parseDotNotation(expectedState) as StateValue,
          context: context ?? defaultContext,
        }),
        {
          type: event,
        }
      )

      expect(actualState.matches(expectedState)).toBeTruthy()
    }
  )

  it("should start in the unauthenticated state", () => {
    const service = interpret().start()
    expect(service.getSnapshot().value).toEqual("unauthenticated")
  })

  it("should transition to the authenticated state when the user is logged in", () => {
    const service = interpret().start()
    service.send({
      type: "LOGIN",
      params: { userAddress: "Alice", userChainType: "near" },
    })
    expect(service.getSnapshot().value).toEqual({
      authenticated: "refreshing balance",
    })
  })

  it("should transition to the unauthenticated state when the user is logged out", () => {
    const service = interpret().start()
    service.send({ type: "LOGOUT" })
    expect(service.getSnapshot().value).toEqual("unauthenticated")
  })

  it("should have equal balances updates are enabled, the balances should be updated immediately after the intent is submitted", () => {})
})

describe("prepareOptimisticBalanceUpdate", () => {
  it("should prepare correctly output with no onchain balances", () => {
    const onchainBalances = {
      BTC: 0n,
      NEAR: 0n,
      USDT: 0n,
    }
    const transitBalances = {
      BTC: 10000n,
      NEAR: 0n,
      USDT: 0n,
    }
    // Swap 0.0001 BTC to 3 NEAR
    const pendingDeltaBalances = {
      BTC: -10000n,
      NEAR: 3000000000000000000000000n,
    }
    const optimisticBalanceChanged = prepareOptimisticBalanceUpdate({
      onchainBalances,
      transitBalances,
      pendingDeltaBalances,
    })

    expect(optimisticBalanceChanged).toEqual({
      BTC: 0n,
      NEAR: 3000000000000000000000000n,
      USDT: 0n,
    })
  })

  it("should prepare correct output withing several delta updates", () => {
    const onchainBalances = {
      BTC: 5000n,
      NEAR: 0n,
      USDT: 0n,
    }
    const transitBalanceSlice = {
      BTC: 5000n,
      NEAR: 0n,
      USDT: 0n,
    }
    // Swap half of 0.0001 BTC to 1.5 NEAR and the other half to 0.5 USDT
    const pendingDeltaBalances = {
      BTC: -10000n,
      NEAR: 1500000000000000000000000n,
      USDT: 50000n,
    }
    const optimisticBalanceChanged = prepareOptimisticBalanceUpdate({
      onchainBalances,
      transitBalances: transitBalanceSlice,
      pendingDeltaBalances,
    })

    expect(optimisticBalanceChanged).toEqual({
      BTC: 0n,
      NEAR: 1500000000000000000000000n,
      USDT: 50000n,
    })
  })
})

describe("properlyCalculateBalanceChanges", () => {
  const defaultContext = {
    balances: { BTC: 0n, NEAR: 0n, USDT: 0n },
    transitBalances: { BTC: 0n, NEAR: 0n, USDT: 0n },
    onchainBalances: { BTC: 0n, NEAR: 0n, USDT: 0n },
  } as unknown as Context

  const defaultBalance = {
    BTC: 0n,
    NEAR: 0n,
    USDT: 0n,
  }

  const defaultOptimisticBalancesEnabled = true

  it("should return onchain balances if optimistic balances are disabled", () => {
    const balanceSlice = {
      BTC: 0n,
      NEAR: 0n,
      USDT: 0n,
    }
    const transitBalances = {
      BTC: 0n,
      NEAR: 0n,
      USDT: 10000n,
    }
    const pendingDeltaBalances = {
      NEAR: 5n,
      USDT: -10000n,
    }

    const { balances } = properlyCalculateBalanceChanges({
      context: { ...defaultContext, optimisticBalancesEnabled: false },
      balances: defaultBalance,
      balanceSlice,
      transitBalances,
      pendingDeltaBalances,
      optimisticBalancesEnabled: false,
    })
    expect(balances).toEqual(defaultBalance)
  })

  it("should return balances withing count pending delta updates", () => {
    const balanceSlice = {
      BTC: 10000n,
      NEAR: 0n,
      USDT: 0n,
    }
    const transitBalances = {
      BTC: 0n,
      NEAR: 0n,
      USDT: 10000n,
    }
    const pendingDeltaBalances = {
      NEAR: 5n,
      USDT: -10000n,
    }

    const { balances } = properlyCalculateBalanceChanges({
      context: defaultContext,
      balances: defaultBalance,
      balanceSlice,
      transitBalances,
      pendingDeltaBalances,
      optimisticBalancesEnabled: defaultOptimisticBalancesEnabled,
    })

    expect(balances).toEqual({
      BTC: 10000n,
      NEAR: 5n,
      USDT: 0n,
    })
  })

  it("should throw an error if the optimistic balance is negative", () => {
    const balanceSlice = {
      BTC: 0n,
      NEAR: 1n,
      USDT: 0n,
    }
    const transitBalances = {
      BTC: 0n,
      NEAR: 0n,
      USDT: 50000n,
    }
    const pendingDeltaBalances = {
      NEAR: -1n,
      USDT: -100000n,
      BTC: 20000n,
    }

    expect(() => {
      properlyCalculateBalanceChanges({
        context: defaultContext,
        balances: defaultBalance,
        balanceSlice,
        transitBalances,
        pendingDeltaBalances,
        optimisticBalancesEnabled: defaultOptimisticBalancesEnabled,
      })
    }).toThrow("Optimistic balance is negative")
  })
})

/**
 * This helper function to parse state paths in dot notation ("a.b.c" = {a: {b: c}})
 */
function parseDotNotation(str: string): object | string {
  const keys = str.split(".")
  const lastKey = keys.pop()

  if (lastKey === undefined) {
    throw new Error("lastKey is undefined")
  }

  return keys.reduceRight<string | object>((acc, key) => {
    return { [key]: acc }
  }, lastKey)
}
