import { type Mock, describe, expect, it, vi } from "vitest"
import type { TokenBalances as TokenBalancesRecord } from "../../../../services/defuseBalanceService"
import type { BaseTokenInfo, TokenValue } from "../../../../types/base"
import type { SwappableToken } from "../../../../types/swap"
import * as tokenUtils from "../../../../utils/token"
import {
  adjustTo1kUsd,
  areAllTokenAddressesSame,
  getMinAmountToken,
  getWithdrawButtonText,
  mapDepositBalancesToDecimals,
  mergeBridgeBalances,
} from "./utils"

describe("adjustTo1kUsd", () => {
  it("calculates the correct adjusted value when amount is small", () => {
    const tokenValue = {
      amount: 2500000000000000000n,
      decimals: 18,
      price: 100, // USD
    }

    const result = adjustTo1kUsd(tokenValue)

    // (2.5 * 100) / 1000 = 0.25 => Math.ceil(0.25) = 1
    expect(result).toBe(1)
  })

  it("calculates the correct adjusted value when amount is large", () => {
    const tokenValue = {
      amount: 1200000000000000000000n,
      decimals: 18,
      price: 2, // USD
    }

    const result = adjustTo1kUsd(tokenValue)

    // (1200 * 2) / 1000 = 2.4 => Math.ceil(2.4) = 2
    expect(result).toBe(2)
  })

  it("returns 0 if the calculated amount is 0", () => {
    const tokenValue = {
      amount: 0n,
      decimals: 18,
      price: 500,
    }

    const result = adjustTo1kUsd(tokenValue)

    // (0 * 500) / 1000 = 0 => Math.ceil(0) = 0
    expect(result).toBe(0)
  })

  it("handles fractional prices properly", () => {
    const tokenValue = {
      amount: 1500000000000000000n,
      decimals: 18,
      price: 33.33,
    }

    const result = adjustTo1kUsd(tokenValue)

    // (1.5 * 33.33) / 1000 ≈ 0.049995 => Math.ceil(0.049995) = 1
    expect(result).toBe(1)
  })

  it("handles when formatUnits returns integer string", () => {
    const tokenValue = {
      amount: 1000000000000000000000n,
      decimals: 18,
      price: 1,
    }

    const result = adjustTo1kUsd(tokenValue)

    // (1000 * 1) / 1000 = 1 => Math.ceil(1) = 1
    expect(result).toBe(1)
  })
})

describe("getMinAmountToken", () => {
  const basicTokenValue = {
    amount: 0n,
    decimals: 6,
  }

  it.each([
    { token1: undefined, token2: undefined, expected: undefined },
    {
      token1: { ...basicTokenValue, amount: 0n },
      token2: { ...basicTokenValue, amount: 0n },
      expected: undefined,
    },
    {
      token1: undefined,
      token2: { ...basicTokenValue, amount: 10n },
      expected: { amount: 10n },
    },
    {
      token1: { ...basicTokenValue, amount: 0n },
      token2: { ...basicTokenValue, amount: 15n },
      expected: { amount: 15n },
    },
    {
      token1: { ...basicTokenValue, amount: 20n },
      token2: undefined,
      expected: { ...basicTokenValue, amount: 20n },
    },
    {
      token1: { ...basicTokenValue, amount: 25n },
      token2: { ...basicTokenValue, amount: 0n },
      expected: { amount: 25n },
    },
    {
      token1: { ...basicTokenValue, amount: 5n },
      token2: { ...basicTokenValue, amount: 10n },
      expected: { ...basicTokenValue, amount: 5n },
    },
    {
      token1: { ...basicTokenValue, amount: 20n },
      token2: { ...basicTokenValue, amount: 15n },
      expected: { ...basicTokenValue, amount: 15n },
    },
    {
      token1: { ...basicTokenValue, amount: 30n },
      token2: { ...basicTokenValue, amount: 30n },
      expected: { ...basicTokenValue, amount: 30n },
    },
  ])(
    "token1: $token1, token2: $token2 => expected: $expected",
    ({ token1, token2, expected }) => {
      const result = getMinAmountToken(token1, token2)

      if (expected === undefined) {
        expect(result).toBeUndefined()
      } else {
        expect(result?.amount).toEqual(expected.amount)
      }
    }
  )
})

describe("getWithdrawButtonText", () => {
  it.each([
    // [noLiquidity, insufficientTokenInAmount, expectedText]
    [true, false, "No liquidity providers"],
    [true, true, "No liquidity providers"],
    [false, true, "Insufficient amount"],
    [false, false, "Withdraw"],
  ])(
    'with noLiquidity=%s and insufficientTokenInAmount=%s returns "%s"',
    (noLiquidity, insufficientTokenInAmount, expected) => {
      const result = getWithdrawButtonText(
        noLiquidity,
        insufficientTokenInAmount
      )
      expect(result).toBe(expected)
    }
  )
})

describe("mergeBridgeBalances", () => {
  const items: {
    name: string
    poaBalances: Record<string, TokenValue>
    nonPoaBalances: Record<string, TokenValue>
    expected: Record<string, TokenValue>
  }[] = [
    {
      name: "returns nonPoaBalances if poaBalances is empty",
      poaBalances: {},
      nonPoaBalances: { token1: { amount: 100n, decimals: 18 } },
      expected: { token1: { amount: 100n, decimals: 18 } },
    },
    {
      name: "adds poaBalances if nonPoaBalances is empty",
      poaBalances: { token2: { amount: 50n, decimals: 18 } },
      nonPoaBalances: {},
      expected: { token2: { amount: 50n, decimals: 18 } },
    },
    {
      name: "merges and picks minimal amount between poa and non-poa balances",
      poaBalances: { token3: { amount: 30n, decimals: 18 } },
      nonPoaBalances: { token3: { amount: 40n, decimals: 18 } },
      expected: { token3: { amount: 30n, decimals: 18 } },
    },
    {
      name: "merges and picks minimal amount between poa and non-poa balances (reverse)",
      poaBalances: { token4: { amount: 80n, decimals: 18 } },
      nonPoaBalances: { token4: { amount: 60n, decimals: 18 } },
      expected: { token4: { amount: 60n, decimals: 18 } },
    },
    {
      name: "merges multiple tokens correctly",
      poaBalances: {
        token5: { amount: 25n, decimals: 18 },
        token6: { amount: 70n, decimals: 18 },
      },
      nonPoaBalances: {
        token5: { amount: 30n, decimals: 18 },
        token7: { amount: 90n, decimals: 18 },
      },
      expected: {
        token5: { amount: 25n, decimals: 18 }, // min(25, 30)
        token6: { amount: 70n, decimals: 18 }, // from poa only
        token7: { amount: 90n, decimals: 18 }, // from non-poa only
      },
    },
  ]

  it.each(items)("$name", ({ poaBalances, nonPoaBalances, expected }) => {
    const result = mergeBridgeBalances(poaBalances, nonPoaBalances)
    expect(result).toEqual(expected)
  })
})

describe("mapDepositBalancesToDecimals", () => {
  vi.mock("../../../../utils/token", () => ({
    isBaseToken: vi.fn(), // Mock the function
  }))
  const mockedIsBaseToken = tokenUtils.isBaseToken as unknown as Mock
  const baseToken: BaseTokenInfo = {
    defuseAssetId: "defuseAssetId",
    address: "address",
    symbol: "symbol",
    name: "name",
    decimals: 6,
    icon: "icon",
    chainName: "eth",
    bridge: "poa",
  }

  const unifiedToken = {
    unifiedAssetId: "unifiedAssetId",
    symbol: "symbol",
    name: "name",
    icon: "icon",
    groupedTokens: [baseToken],
  }
  const items: {
    name: string
    balances: TokenBalancesRecord | undefined
    token: SwappableToken
    isBase: boolean
    expected: Record<BaseTokenInfo["defuseAssetId"], TokenValue>
  }[] = [
    {
      name: "returns empty object if balances is undefined",
      balances: undefined,
      token: { ...baseToken, defuseAssetId: "token1", decimals: 18 },
      isBase: true,
      expected: {},
    },
    {
      name: "maps base token correctly when address matches",
      balances: { token1: 1000n },
      token: { ...baseToken, defuseAssetId: "token1", decimals: 18 },
      isBase: true,
      expected: { token1: { amount: 1000n, decimals: 18 } },
    },
    {
      name: "skips base token when address does not match",
      balances: { token2: 500n },
      token: { ...baseToken, defuseAssetId: "token1", decimals: 18 },
      isBase: true,
      expected: {},
    },
    {
      name: "maps grouped token correctly when address matches",
      balances: { groupedToken1: 2000n },
      token: {
        ...unifiedToken,
        groupedTokens: [
          { ...baseToken, defuseAssetId: "groupedToken1", decimals: 8 },
        ],
      },
      isBase: false,
      expected: { groupedToken1: { amount: 2000n, decimals: 8 } },
    },
    {
      name: "skips grouped token if no match",
      balances: { groupedToken2: 3000n },
      token: {
        ...unifiedToken,
        groupedTokens: [
          { ...baseToken, defuseAssetId: "groupedToken1", decimals: 8 },
        ],
      },
      isBase: false,
      expected: {},
    },
  ]

  it.each(items)("$name", ({ balances, token, isBase, expected }) => {
    mockedIsBaseToken.mockReturnValue(isBase)

    const result = mapDepositBalancesToDecimals(balances, token)
    expect(result).toEqual(expected)
  })
})

describe("areAllTokenAddressesSame", () => {
  vi.mock("../../../../utils/token", () => ({
    isBaseToken: vi.fn(), // Mock the function
  }))
  const mockedIsBaseToken = tokenUtils.isBaseToken as unknown as Mock
  const baseToken: BaseTokenInfo = {
    defuseAssetId: "defuseAssetId",
    address: "address",
    symbol: "symbol",
    name: "name",
    decimals: 6,
    icon: "icon",
    chainName: "eth",
    bridge: "poa",
  }

  const unifiedToken = {
    unifiedAssetId: "unifiedAssetId",
    symbol: "symbol",
    name: "name",
    icon: "icon",
    groupedTokens: [baseToken],
  }

  const items: {
    name: string
    token: SwappableToken
    isBase: boolean
    expected: boolean
  }[] = [
    {
      name: "returns false if token is base token",
      token: {
        ...baseToken,
        groupedTokens: [
          { ...baseToken, defuseAssetId: "abc" },
          { ...baseToken, defuseAssetId: "abc" },
        ],
      },
      isBase: true,
      expected: false,
    },
    {
      name: "returns true if all grouped token addresses are same",
      token: {
        ...unifiedToken,
        groupedTokens: [
          { ...baseToken, defuseAssetId: "abc" },
          { ...baseToken, defuseAssetId: "abc" },
        ],
      },
      isBase: false,
      expected: true,
    },
    {
      name: "returns false if any grouped token address is different",
      token: {
        ...unifiedToken,
        groupedTokens: [
          { ...baseToken, defuseAssetId: "abc" },
          { ...baseToken, defuseAssetId: "def" },
        ],
      },
      isBase: false,
      expected: false,
    },
    {
      name: "returns true for single grouped token",
      token: {
        ...unifiedToken,
        groupedTokens: [{ ...baseToken, defuseAssetId: "onlyone" }],
      },
      isBase: false,
      expected: true,
    },
    {
      name: "returns true for empty groupedTokens list",
      token: { ...unifiedToken, groupedTokens: [] },
      isBase: false,
      expected: true,
    },
  ]

  it.each(items)("$name", ({ token, isBase, expected }) => {
    mockedIsBaseToken.mockReturnValue(isBase)

    const result = areAllTokenAddressesSame(token)
    expect(result).toBe(expected)
  })
})
