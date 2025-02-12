import type { SupportedChainName } from "src/types/base"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  type StateValue,
  createActor,
  fromPromise,
  getNextSnapshot,
  spawnChild,
} from "xstate"
import { type Context, swapUIMachine } from "./swapUIMachine"

describe("swapUIMachine", () => {
  const defaultActorImpls = {
    backgroundQuoterActor: vi.fn(async ({ self }) => {
      self.send({
        type: "NEW_QUOTE_INPUT",
        params: {
          quoteInput: {
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
          },
          quote: {
            tag: "ok",
            value: {
              expirationTime: new Date().toISOString(),
              quoteHashes: ["hash"],
              tokenDeltas: [
                ["NEAR", -1000000n],
                ["NEAR", 300000000000000000000000n],
              ],
            },
          },
        },
      })
    }),
  }

  const defaultActors = {
    backgroundQuoterActor: fromPromise(defaultActorImpls.backgroundQuoterActor),
  }

  const defaultActions = {
    updateUIAmountOut: vi.fn(),
    spawnBackgroundQuoterRef: spawnChild("backgroundQuoterActor", {
      id: "backgroundQuoterRef",
      input: defaultActorImpls.backgroundQuoterActor,
    }),
  }

  const defaultGuards = {}

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
  const mockTokenOut = {
    unifiedAssetId: "near",
    decimals: 24,
    symbol: "NEAR",
    name: "Near",
    icon: "icon",
    groupedTokens: [
      {
        defuseAssetId: "nep141:2",
        address: "2",
        decimals: 24,
        icon: "icon",
        chainId: "",
        chainIcon: "icon",
        chainName: "near" as SupportedChainName,
        routes: [],
        symbol: "NEAR",
        name: "Near",
      },
    ],
  }

  const defaultContext: Context = {
    error: null,
    quote: null,
    formValues: {
      tokenIn: mockTokenIn,
      tokenOut: mockTokenOut,
      amountIn: "",
    },
    parsedFormValues: {
      tokenOut: {
        address: "2",
        chainIcon: "icon",
        chainId: "",
        chainName: "near",
        decimals: 24,
        defuseAssetId: "nep141:2",
        icon: "icon",
        name: "Near",
        routes: [],
        symbol: "NEAR",
      },
      amountIn: null,
    },
    intentCreationResult: null,
    intentRefs: [],
    tokenList: [],
    referral: undefined,
    slippageBasisPoints: 100,
    intentSignResult: null,
  }

  let actors: typeof defaultActors
  let actions: typeof defaultActions
  let guards: typeof defaultGuards

  function populateMachine() {
    // @ts-expect-error
    return swapUIMachine.provide({ actors, actions, guards })
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

  beforeEach(() => {
    actors = { ...defaultActors }
    actions = { ...defaultActions }
    guards = { ...defaultGuards }
  })

  it.skip.each`
    initialState      | expectedState           | event      | guards  | context
    ${"editing.idle"} | ${"editing.validating"} | ${"input"} | ${null} | ${null}
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
          params: {
            tokenIn: mockTokenIn,
            tokenOut: mockTokenOut,
            amountIn: "1",
          },
        }
      )

      expect(actualState.matches(expectedState)).toBeTruthy()
    }
  )

  it("should start in the idle state", () => {
    const service = interpret().start()
    expect(service.getSnapshot().value).toEqual({ editing: "idle" })
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
