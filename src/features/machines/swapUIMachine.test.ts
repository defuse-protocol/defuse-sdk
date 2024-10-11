import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  SimulatedClock,
  type StateValue,
  createActor,
  fromPromise,
  getNextSnapshot,
} from "xstate"
import type { Output } from "./swapIntentMachine"
import { type QuoteTmp, swapUIMachine } from "./swapUIMachine"

describe("swapUIMachine", () => {
  const defaultActorImpls = {
    formValidation: vi.fn(async (): Promise<boolean> => {
      return true
    }),
    queryQuote: vi.fn(async (): Promise<QuoteTmp> => {
      return {}
    }),
    swap: async (): Promise<Output> => {
      return {}
    },
  }

  const defaultActors = {
    formValidation: fromPromise(defaultActorImpls.formValidation),
    queryQuote: fromPromise(defaultActorImpls.queryQuote),
    swap: fromPromise(defaultActorImpls.swap),
  }

  const defaultActions = {}

  const defaultGuards = {
    isFormValid: vi.fn(),
    isQuoteRelevant: vi.fn(),
  }

  const defaultContext = {
    error: null,
    quote: null,
    outcome: null,
  }

  let actors: typeof defaultActors
  let actions: typeof defaultActions
  let guards: typeof defaultGuards
  let simulatedClock: SimulatedClock

  function populateMachine() {
    return swapUIMachine.provide({ actors, actions, guards })
  }

  function interpret() {
    return createActor(populateMachine(), { clock: simulatedClock })
  }

  beforeEach(() => {
    actors = { ...defaultActors }
    actions = { ...defaultActions }
    guards = { ...defaultGuards }
    simulatedClock = new SimulatedClock()
  })

  const T = () => true
  const F = () => false

  it.each`
    initialState      | expectedState           | event      | guards  | context
    ${"editing.idle"} | ${"editing.validating"} | ${"input"} | ${null} | ${null}
  `(
    'should reach "$expectedState" given "$initialState" when the "$event" event occurs',
    ({ initialState, expectedState, event, guards, context }) => {
      const machine = swapUIMachine.provide({
        guards: { ...defaultGuards, ...guards },
      })

      const actualState = getNextSnapshot(
        machine,
        machine.resolveState({
          value: parseDotNotation(initialState) as StateValue,
          context: context ?? defaultContext,
        }),
        { type: event }
      )

      expect(actualState.matches(expectedState)).toBeTruthy()
    }
  )

  it("should start in the editing state", () => {
    const service = interpret().start()
    expect(service.getSnapshot().value).toEqual({ editing: "idle" })
  })

  it("should set and reset the quote querying error", async () => {
    // arrange
    const err = new Error("Something went wrong")
    defaultActorImpls.queryQuote
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({})
    const service = interpret().start()

    // act
    service.send({ type: "input" })
    simulatedClock.increment(10000)
    // give some time for machine to transition
    await new Promise((resolve) => setTimeout(resolve, 0))

    // assert
    expect(service.getSnapshot().context.error).toBe(err)

    service.send({ type: "input" })
    expect(service.getSnapshot().context.error).toBeNull()
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
