import type { providers } from "near-api-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type ActorRefFrom,
  type SnapshotFrom,
  type StateValue,
  createActor,
  fromCallback,
  fromPromise,
  getNextSnapshot,
  sendTo,
  spawnChild,
} from "xstate"
import type { QuoteResult } from "../../services/quoteService"
import type { BaseTokenInfo, SupportedChainName } from "../../types/base"
import type { Events, QuoteInput } from "./backgroundQuoterMachine"
import type { depositedBalanceMachine } from "./depositedBalanceMachine"
import type { poaBridgeInfoActor } from "./poaBridgeInfoActor"
import type { withdrawFormReducer } from "./withdrawFormReducer"
import { type Context, withdrawUIMachine } from "./withdrawUIMachine"

describe("withdrawUIMachine", () => {
  const mockTokenIn = {
    unifiedAssetId: "usdc",
    decimals: 6,
    symbol: "USDC",
    name: "USDC",
    icon: "icon",
    groupedTokens: [
      {
        defuseAssetId: "nep141:1",
        address: "1",
        decimals: 6,
        icon: "icon",
        chainId: "",
        chainIcon: "icon",
        chainName: "near" as SupportedChainName,
        routes: [],
        symbol: "USDC",
        name: "USDC",
      },
    ],
  }
  const mockTokenOut: BaseTokenInfo = {
    address: "2",
    chainIcon: "icon",
    chainId: "",
    chainName: "near" as SupportedChainName,
    decimals: 24,
    defuseAssetId: "nep141:2",
    icon: "icon",
    name: "Near",
    routes: [],
    symbol: "NEAR",
  }

  const mockQuoteInput: QuoteInput = {
    amountIn: {
      amount: 1000000n,
      decimals: 6,
    },
    balances: {
      BTC: 0n,
      NEAR: 0n,
      USDT: 0n,
    },
    tokenIn: mockTokenIn,
    tokenOut: mockTokenOut,
  }

  const mockQuote: QuoteResult = {
    tag: "ok",
    value: {
      expirationTime: new Date().toISOString(),
      quoteHashes: ["hash"],
      tokenDeltas: [
        ["NEAR", -1000000n],
        ["NEAR", 300000000000000000000000n],
      ],
    },
  }

  const defaultActorImpls = {
    backgroundQuoterActor: vi.fn(({ receive = () => {}, emit, input }) => {
      receive((event: Events) => {
        switch (event.type) {
          case "PAUSE":
            return
          case "NEW_QUOTE_INPUT": {
            input.parentRef.send({
              type: "NEW_QUOTE",
              params: { quoteInput: mockQuoteInput, quote: mockQuote },
            })
            emit({
              type: "NEW_QUOTE",
              params: { quoteInput: mockQuoteInput, quote: mockQuote },
            })
            return
          }
          default:
            break
        }
      })
    }),
    sendToBackgroundQuoterRefNewQuoteInput: vi.fn(async ({ self }) => {
      return {
        parentRef: self,
        delayMs: 1000,
      }
    }),
    intentSignActor: vi.fn(async () => {
      return {
        tag: "ok",
        value: {
          userAddress: "Alice",
          userChainType: "near",
          defuseUserId: "defuseUserId",
          referral: undefined,
          slippageBasisPoints: 100,
          nearClient: {} as providers.Provider,
          sendNearTransaction: vi.fn(() =>
            Promise.resolve({ txHash: "txHash" })
          ),
          intentOperationParams: {
            type: "swap",
            tokensIn: [mockTokenIn],
            tokenOut: mockTokenOut,
            quote: mockQuote,
          },
          quoteToPublish: mockQuote,
          quotes: mockQuote,
          messageToSign: {
            walletMessage: {
              message: "message",
              signature: "signature",
            },
            innerMessage: {
              message: "message",
              signature: "signature",
            },
          },
          signature: {
            signature: "signature",
          },
          intentDescription: {
            type: "swap",
            totalAmountIn: "1",
            totalAmountOut: "2",
          },
        },
      }
    }),
    intentBroadcastActor: vi.fn(async () => {
      return {
        tag: "ok",
        value: {
          intentHash: "intentHash",
          intentDescription: {
            type: "swap",
            totalAmountIn: "1",
            totalAmountOut: "2",
          },
        },
      }
    }),
  }

  const defaultActors = {
    backgroundQuoterActor: fromCallback(
      defaultActorImpls.backgroundQuoterActor
    ),
    intentSignActor: fromPromise(defaultActorImpls.intentSignActor),
    intentBroadcastActor: fromPromise(defaultActorImpls.intentBroadcastActor),
  }

  const defaultActions = {
    updateUIAmountOut: vi.fn(),
    spawnBackgroundQuoterRef: spawnChild("backgroundQuoterActor", {
      id: "backgroundQuoterRef",
      input: defaultActorImpls.backgroundQuoterActor,
    }),
    sendToBackgroundQuoterRefNewQuoteInput: sendTo(
      "backgroundQuoterRef",
      defaultActorImpls.sendToBackgroundQuoterRefNewQuoteInput
    ),
  }

  const defaultGuards = {}

  const defaultContext: Context = {
    error: null,
    intentCreationResult: null,
    intentRefs: [],
    tokenList: [],
    depositedBalanceRef: {} as ActorRefFrom<typeof depositedBalanceMachine>,
    withdrawFormRef: {} as ActorRefFrom<typeof withdrawFormReducer>,
    poaBridgeInfoRef: {} as ActorRefFrom<typeof poaBridgeInfoActor>,
    submitDeps: null,
    preparationOutput: null,
    referral: undefined,
    intentSignResult: null,
  }

  let actors: typeof defaultActors
  let actions: typeof defaultActions
  let guards: typeof defaultGuards

  function populateMachine() {
    // @ts-expect-error
    return withdrawUIMachine.provide({ actors, actions, guards })
  }

  function interpret() {
    return createActor(populateMachine(), {
      input: {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        tokenList: [],
        referral: undefined,
      },
    })
  }

  let service: ActorRefFrom<typeof withdrawUIMachine>

  beforeEach(() => {
    actors = { ...defaultActors }
    actions = { ...defaultActions }
    guards = { ...defaultGuards }

    service = interpret().start()
  })

  afterEach(() => {
    service.stop()
  })

  it.skip.each`
    initialState      | expectedState           | event                             | guards  | context
    ${"editing.idle"} | ${"editing.validating"} | ${"WITHDRAW_FORM_FIELDS_CHANGED"} | ${null} | ${null}
  `(
    'should reach "$expectedState" given "$initialState" when the "$event" event occurs',
    ({ initialState, expectedState, event, context }) => {
      const machine = populateMachine()

      const actualState = getNextSnapshot(
        machine,
        machine.resolveState({
          value: parseDotNotation(initialState) as StateValue,
          context: context ?? defaultContext,
        }),
        {
          type: event,
        }
      )

      expect(actualState.matches(expectedState)).toBeTruthy()
    }
  )

  it("should start in the idle state", () => {
    expect(service.getSnapshot().value).toEqual({ editing: "idle" })
  })

  it("should transiting to idle when NEW_QUOTE event occurs", () => {
    service.send({
      type: "NEW_QUOTE",
      params: { quoteInput: mockQuoteInput, quote: mockQuote },
    })
    expect(service.getSnapshot().value).toEqual({ editing: "idle" })
  })

  it("should transiting to submitting when submit event occurs", () => {
    expect(service.getSnapshot().value).toEqual({ editing: "idle" })

    service.send({
      type: "NEW_QUOTE",
      params: { quoteInput: mockQuoteInput, quote: mockQuote },
    })

    service.send({
      type: "submit",
      params: {
        userAddress: "Alice",
        userChainType: "near",
        nearClient: {} as providers.Provider,
        sendNearTransaction: vi.fn(() => Promise.resolve({ txHash: "txHash" })),
      },
    })

    service.subscribe(() => {
      expect(service.getSnapshot().value).toEqual("submitting")
    })
  })

  it("when submitting state is reached, `intentSignActor()` should be triggered", () => {
    service.send({
      type: "NEW_QUOTE",
      params: { quoteInput: mockQuoteInput, quote: mockQuote },
    })

    service.send({
      type: "submit",
      params: {
        userAddress: "Alice",
        userChainType: "near",
        nearClient: {} as providers.Provider,
        sendNearTransaction: vi.fn(() => Promise.resolve({ txHash: "txHash" })),
      },
    })

    service.subscribe(() => {
      expect(service.getSnapshot().value).toEqual("submitting")
      expect(defaultActorImpls.intentSignActor).toHaveBeenCalled()
    })
  })

  it("should transition to broadcasting when intentSignActor completes", () => {
    let broadcastingReached = false

    const listener = (state: SnapshotFrom<typeof withdrawUIMachine>) => {
      if (state.value === "broadcasting") {
        broadcastingReached = true
        service.stop()
        expect(broadcastingReached).toBeTruthy()
      }
    }

    service.subscribe(listener)

    service.send({
      type: "NEW_QUOTE",
      params: { quoteInput: mockQuoteInput, quote: mockQuote },
    })

    service.send({
      type: "submit",
      params: {
        userAddress: "Alice",
        userChainType: "near",
        nearClient: {} as providers.Provider,
        sendNearTransaction: vi.fn(() => Promise.resolve({ txHash: "txHash" })),
      },
    })
  })

  it("when broadcasting state is reached, `intentBroadcastActor()` should be triggered", () => {
    service.send({
      type: "NEW_QUOTE",
      params: { quoteInput: mockQuoteInput, quote: mockQuote },
    })

    service.send({
      type: "submit",
      params: {
        userAddress: "Alice",
        userChainType: "near",
        nearClient: {} as providers.Provider,
        sendNearTransaction: vi.fn(() => Promise.resolve({ txHash: "txHash" })),
      },
    })

    service.subscribe(() => {
      expect(defaultActorImpls.intentBroadcastActor).toHaveBeenCalled()
    })
  })

  it("should transition to idle when intentBroadcastActor completes", () => {
    let broadcastingReached = false
    let idleReached = false

    const listener = (state: SnapshotFrom<typeof withdrawUIMachine>) => {
      if (state.value === "broadcasting") {
        broadcastingReached = true
        expect(broadcastingReached).toBeTruthy()
      }

      if (JSON.stringify(state.value) === JSON.stringify({ editing: "idle" })) {
        idleReached = true
        expect(idleReached).toBeTruthy()
      }
    }

    service.subscribe(listener)

    service.send({
      type: "NEW_QUOTE",
      params: { quoteInput: mockQuoteInput, quote: mockQuote },
    })

    service.send({
      type: "submit",
      params: {
        userAddress: "Alice",
        userChainType: "near",
        nearClient: {} as providers.Provider,
        sendNearTransaction: vi.fn(() => Promise.resolve({ txHash: "txHash" })),
      },
    })
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
