import { describe, expect, it } from "vitest"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import {
  DuplicateTokenError,
  accountSlippage,
  addAmounts,
  adjustDecimals,
  compareAmounts,
  computeTotalBalance,
  computeTotalBalanceDifferentDecimals,
  computeTotalDeltaDifferentDecimals,
  getDerivedToken,
  getUnderlyingBaseTokenInfos,
  subtractAmounts,
} from "./tokenUtils"

describe("computeTotalBalance", () => {
  const balances = {
    token1: 100n,
    token2: 200n,
  }

  describe("with token ID array", () => {
    it("should sum balances for token array", () => {
      expect(computeTotalBalance(["token1", "token2"], balances)).toBe(300n)
    })

    it("should handle duplicate tokens in array", () => {
      expect(
        computeTotalBalance(["token1", "token1", "token2"], balances)
      ).toBe(300n)
    })

    it("should return undefined if any balance is missing", () => {
      expect(
        computeTotalBalance(["token1", "missing"], balances)
      ).toBeUndefined()
    })

    it("should return undefined if all balances are missing", () => {
      expect(
        computeTotalBalance(["missing1", "missing2"], balances)
      ).toBeUndefined()
    })
  })

  describe("with base token", () => {
    const baseToken: BaseTokenInfo = {
      defuseAssetId: "token1",
      address: "0x123",
      symbol: "TKN",
      name: "Token",
      decimals: 18,
      icon: "icon.png",
      chainId: "",
      chainIcon: "chain.png",
      chainName: "eth",
      routes: [],
    }

    it("should return balance for base token", () => {
      expect(computeTotalBalance(baseToken, balances)).toBe(100n)
    })

    it("should return undefined if balance missing", () => {
      const missingToken = { ...baseToken, defuseAssetId: "missing" }
      expect(computeTotalBalance(missingToken, balances)).toBeUndefined()
    })
  })

  describe("with unified token", () => {
    const unifiedToken: UnifiedTokenInfo = {
      unifiedAssetId: "unified1",
      symbol: "UTKN",
      name: "Unified Token",
      icon: "icon.png",
      groupedTokens: [
        {
          defuseAssetId: "token1",
          address: "0x123",
          symbol: "TKN1",
          name: "Token1",
          decimals: 18,
          icon: "icon1.png",
          chainId: "",
          chainIcon: "chain1.png",
          chainName: "eth",
          routes: [],
        },
        {
          defuseAssetId: "token2",
          address: "0x456",
          symbol: "TKN2",
          name: "Token2",
          decimals: 18,
          icon: "icon2.png",
          chainId: "2",
          chainIcon: "chain2.png",
          chainName: "base",
          routes: [],
        },
      ],
    }

    it("should sum all available balances", () => {
      expect(computeTotalBalance(unifiedToken, balances)).toBe(300n)
    })

    it("should return undefined if any balance is missing", () => {
      const tokenWithMissing = {
        ...unifiedToken,
        groupedTokens: [
          ...unifiedToken.groupedTokens,
          {
            // biome-ignore lint/style/noNonNullAssertion: It exists
            ...unifiedToken.groupedTokens[0]!, // Duplicate token1
            defuseAssetId: "missing",
          },
        ],
      }
      expect(computeTotalBalance(tokenWithMissing, balances)).toBeUndefined()
    })

    it("should handle duplicate tokens in unified token", () => {
      const tokenWithDuplicates = {
        ...unifiedToken,
        groupedTokens: [
          ...unifiedToken.groupedTokens,
          // biome-ignore lint/style/noNonNullAssertion: It exists
          unifiedToken.groupedTokens[0]!, // Duplicate token1
        ],
      }
      expect(computeTotalBalance(tokenWithDuplicates, balances)).toBe(300n)
    })
  })
})

describe("computeTotalBalanceDifferentDecimals", () => {
  const balances = {
    token1: 100n,
    token2: 200n,
  }

  describe("with empty token list", () => {
    it("should handle empty unified token", () => {
      const emptyUnified: UnifiedTokenInfo = {
        unifiedAssetId: "unified1",
        symbol: "UTKN",
        name: "Unified Token",
        icon: "icon.png",
        groupedTokens: [],
      }
      expect(
        computeTotalBalanceDifferentDecimals(emptyUnified, balances)
      ).toEqual({
        amount: 0n,
        decimals: 0,
      })
    })

    it("should handle empty array", () => {
      expect(computeTotalBalanceDifferentDecimals([], balances)).toEqual({
        amount: 0n,
        decimals: 0,
      })
    })
  })

  it("should handle empty token array", () => {
    expect(computeTotalBalanceDifferentDecimals([], balances)).toEqual({
      amount: 0n,
      decimals: 0,
    })
  })

  it("should skip missing balances when strict is false", () => {
    const tokens: BaseTokenInfo[] = [
      {
        defuseAssetId: "token1",
        address: "0x123",
        symbol: "TKN1",
        name: "Token1",
        decimals: 18,
        icon: "icon1.png",
        chainId: "",
        chainIcon: "chain1.png",
        chainName: "eth",
        routes: [],
      },
      {
        defuseAssetId: "missing",
        address: "0x456",
        symbol: "TKN2",
        name: "Token2",
        decimals: 18,
        icon: "icon2.png",
        chainId: "",
        chainIcon: "chain2.png",
        chainName: "eth",
        routes: [],
      },
    ]

    expect(
      computeTotalBalanceDifferentDecimals(tokens, balances, { strict: false })
    ).toEqual({
      amount: 100n,
      decimals: 18,
    })
  })

  it("should return undefined when all balances are missing even with strict false", () => {
    const tokens: BaseTokenInfo[] = [
      {
        defuseAssetId: "missing1",
        address: "0x123",
        symbol: "TKN1",
        name: "Token1",
        decimals: 18,
        icon: "icon1.png",
        chainId: "",
        chainIcon: "chain1.png",
        chainName: "eth",
        routes: [],
      },
      {
        defuseAssetId: "missing2",
        address: "0x456",
        symbol: "TKN2",
        name: "Token2",
        decimals: 18,
        icon: "icon2.png",
        chainId: "",
        chainIcon: "chain2.png",
        chainName: "eth",
        routes: [],
      },
    ]

    expect(
      computeTotalBalanceDifferentDecimals(tokens, balances, { strict: false })
    ).toBeUndefined()
  })

  describe("with base token", () => {
    const baseToken: BaseTokenInfo = {
      defuseAssetId: "token1",
      address: "0x123",
      symbol: "TKN",
      name: "Token",
      decimals: 18,
      icon: "icon.png",
      chainId: "",
      chainIcon: "chain.png",
      chainName: "eth",
      routes: [],
    }

    it("should return balance and decimals for base token", () => {
      expect(computeTotalBalanceDifferentDecimals(baseToken, balances)).toEqual(
        {
          amount: 100n,
          decimals: 18,
        }
      )
    })

    it("should return undefined if balance missing", () => {
      const missingToken = { ...baseToken, defuseAssetId: "missing" }
      expect(
        computeTotalBalanceDifferentDecimals(missingToken, balances)
      ).toBeUndefined()
    })
  })

  describe("with unified token", () => {
    const unifiedToken: UnifiedTokenInfo = {
      unifiedAssetId: "unified1",
      symbol: "UTKN",
      name: "Unified Token",
      icon: "icon.png",
      groupedTokens: [
        {
          defuseAssetId: "token1",
          address: "0x123",
          symbol: "TKN1",
          name: "Token1",
          decimals: 18,
          icon: "icon1.png",
          chainId: "",
          chainIcon: "chain1.png",
          chainName: "eth",
          routes: [],
        },
        {
          defuseAssetId: "token2",
          address: "0x456",
          symbol: "TKN2",
          name: "Token2",
          decimals: 18,
          icon: "icon2.png",
          chainId: "2",
          chainIcon: "chain2.png",
          chainName: "base",
          routes: [],
        },
      ],
    }

    it("should sum all available balances", () => {
      expect(
        computeTotalBalanceDifferentDecimals(unifiedToken, balances)
      ).toEqual({
        amount: 300n,
        decimals: 18,
      })
    })

    it("should return undefined if any balance is missing", () => {
      const tokenWithMissing = {
        ...unifiedToken,
        groupedTokens: [
          ...unifiedToken.groupedTokens,
          {
            // biome-ignore lint/style/noNonNullAssertion: It exists
            ...unifiedToken.groupedTokens[0]!, // Duplicate token1
            defuseAssetId: "missing",
          },
        ],
      }
      expect(
        computeTotalBalanceDifferentDecimals(tokenWithMissing, balances)
      ).toBeUndefined()
    })

    it("should handle duplicate tokens in unified token", () => {
      const tokenWithDuplicates = {
        ...unifiedToken,
        groupedTokens: [
          ...unifiedToken.groupedTokens,
          // biome-ignore lint/style/noNonNullAssertion: It exists
          unifiedToken.groupedTokens[0]!, // Duplicate token1
        ],
      }
      expect(
        computeTotalBalanceDifferentDecimals(tokenWithDuplicates, balances)
      ).toEqual({
        amount: 300n,
        decimals: 18,
      })
    })
  })

  describe("with unified token with different decimals", () => {
    const balances = {
      token1: 1000000n, // 1.0 with 6 decimals
      token2: 1000000000000000000n, // 1.0 with 18 decimals
    }

    const unifiedToken: UnifiedTokenInfo = {
      unifiedAssetId: "unified1",
      symbol: "UTKN",
      name: "Unified Token",
      icon: "icon.png",
      groupedTokens: [
        {
          defuseAssetId: "token1",
          address: "0x123",
          symbol: "TKN1",
          name: "Token1",
          decimals: 6,
          icon: "icon1.png",
          chainId: "",
          chainIcon: "chain1.png",
          chainName: "eth",
          routes: [],
        },
        {
          defuseAssetId: "token2",
          address: "0x456",
          symbol: "TKN2",
          name: "Token2",
          decimals: 18,
          icon: "icon2.png",
          chainId: "2",
          chainIcon: "chain2.png",
          chainName: "base",
          routes: [],
        },
      ],
    }

    it("should normalize balances and return highest decimals", () => {
      const result = computeTotalBalanceDifferentDecimals(
        unifiedToken,
        balances
      )
      expect(result).toEqual({
        amount: 2000000000000000000n,
        decimals: 18,
      })
    })
  })

  describe("with unified token with duplicates", () => {
    const balances = {
      token1: 1000000n, // 1.0 with 6 decimals
      token2: 1000000000000000000n, // 1.0 with 18 decimals
    }

    const unifiedToken: UnifiedTokenInfo = {
      unifiedAssetId: "unified1",
      symbol: "UTKN",
      name: "Unified Token",
      icon: "icon.png",
      groupedTokens: [
        {
          defuseAssetId: "token1",
          address: "0x123",
          symbol: "TKN1",
          name: "Token1",
          decimals: 6,
          icon: "icon1.png",
          chainId: "",
          chainIcon: "chain1.png",
          chainName: "eth",
          routes: [],
        },
        {
          defuseAssetId: "token1", // Duplicate with different decimals
          address: "0x124",
          symbol: "TKN1",
          name: "Token1",
          decimals: 18,
          icon: "icon1.png",
          chainId: "",
          chainIcon: "chain1.png",
          chainName: "eth",
          routes: [],
        },
        {
          defuseAssetId: "token2",
          address: "0x456",
          symbol: "TKN2",
          name: "Token2",
          decimals: 18,
          icon: "icon2.png",
          chainId: "2",
          chainIcon: "chain2.png",
          chainName: "base",
          routes: [],
        },
      ],
    }

    it("should throw when tokens are duplicated with different decimals", () => {
      expect(() =>
        computeTotalBalanceDifferentDecimals(unifiedToken, balances)
      ).toThrow(DuplicateTokenError)
    })

    it("should allow duplicate tokens with same decimals", () => {
      const sameDecimalToken: UnifiedTokenInfo = {
        ...unifiedToken,
        groupedTokens: [
          {
            defuseAssetId: "token1",
            address: "0x123",
            symbol: "TKN1",
            name: "Token1",
            decimals: 6,
            icon: "icon1.png",
            chainId: "",
            chainIcon: "chain1.png",
            chainName: "eth",
            routes: [],
          },
          {
            defuseAssetId: "token1",
            address: "0x124",
            symbol: "TKN1",
            name: "Token1",
            decimals: 6,
            icon: "icon1.png",
            chainId: "",
            chainIcon: "chain1.png",
            chainName: "eth",
            routes: [],
          },
          {
            defuseAssetId: "token2",
            address: "0x456",
            symbol: "TKN2",
            name: "Token2",
            decimals: 18,
            icon: "icon2.png",
            chainId: "2",
            chainIcon: "chain2.png",
            chainName: "base",
            routes: [],
          },
        ],
      }
      expect(
        computeTotalBalanceDifferentDecimals(sameDecimalToken, balances)
      ).toEqual({
        amount: 2000000000000000000n,
        decimals: 18,
      })
    })
  })
})

describe("getDerivedToken", () => {
  const tokenList: Array<BaseTokenInfo | UnifiedTokenInfo> = [
    {
      unifiedAssetId: "unified1",
      symbol: "UTKN",
      name: "Unified Token",
      decimals: 18,
      icon: "icon.png",
      groupedTokens: [
        {
          defuseAssetId: "token1",
          address: "0x123",
          symbol: "TKN1",
          name: "Token1",
          decimals: 18,
          icon: "icon1.png",
          chainId: "",
          chainIcon: "chain1.png",
          chainName: "eth",
          routes: [],
        },
        {
          defuseAssetId: "token2",
          address: "0x456",
          symbol: "TKN2",
          name: "Token2",
          decimals: 18,
          icon: "icon2.png",
          chainId: "2",
          chainIcon: "chain2.png",
          chainName: "base",
          routes: [],
        },
      ],
    },
    {
      defuseAssetId: "token3",
      address: "0x789",
      symbol: "TKN3",
      name: "Token3",
      decimals: 18,
      icon: "icon3.png",
      chainId: "",
      chainIcon: "chain.png",
      chainName: "eth",
      routes: [],
    },
  ]
  it("should derive token from unified token list", () => {
    // biome-ignore lint/style/noNonNullAssertion: It exists
    const unifiedToken = tokenList[0]!
    expect(getDerivedToken(unifiedToken, "eth")).toEqual({
      defuseAssetId: "token1",
      address: "0x123",
      symbol: "TKN1",
      name: "Token1",
      decimals: 18,
      icon: "icon1.png",
      chainId: "",
      chainIcon: "chain1.png",
      chainName: "eth",
      routes: [],
    })
  })

  it("should derive token from base token", () => {
    // biome-ignore lint/style/noNonNullAssertion: It exists
    const baseToken = tokenList[1]!
    expect(getDerivedToken(baseToken, "eth")).toEqual({
      defuseAssetId: "token3",
      address: "0x789",
      symbol: "TKN3",
      name: "Token3",
      decimals: 18,
      icon: "icon3.png",
      chainId: "",
      chainIcon: "chain.png",
      chainName: "eth",
      routes: [],
    })
  })

  it("should return null if token is not derivable from unified token list", () => {
    // biome-ignore lint/style/noNonNullAssertion: It exists
    const unifiedToken = tokenList[0]!
    expect(getDerivedToken(unifiedToken, "unknown_chain")).toBeNull()
  })

  it("should return null if token is not derivable from base token", () => {
    // biome-ignore lint/style/noNonNullAssertion: It exists
    const baseToken = tokenList[1]!
    expect(getDerivedToken(baseToken, "unknown_chain")).toBeNull()
  })
})

describe("compareAmounts", () => {
  it("should compare amounts with same decimals", () => {
    expect(
      compareAmounts(
        { amount: 100n, decimals: 18 },
        { amount: 200n, decimals: 18 }
      )
    ).toBe(-1)
    expect(
      compareAmounts(
        { amount: 200n, decimals: 18 },
        { amount: 100n, decimals: 18 }
      )
    ).toBe(1)
    expect(
      compareAmounts(
        { amount: 100n, decimals: 18 },
        { amount: 100n, decimals: 18 }
      )
    ).toBe(0)
  })

  it("should compare amounts with different decimals", () => {
    // 1.0 (6 decimals) vs 0.5 (18 decimals)
    expect(
      compareAmounts(
        { amount: 1000000n, decimals: 6 },
        { amount: 500000000000000000n, decimals: 18 }
      )
    ).toBe(1)
    // 0.5 (6 decimals) vs 1.0 (18 decimals)
    expect(
      compareAmounts(
        { amount: 500000n, decimals: 6 },
        { amount: 1000000000000000000n, decimals: 18 }
      )
    ).toBe(-1)
    // 1.0 (6 decimals) vs 1.0 (18 decimals)
    expect(
      compareAmounts(
        { amount: 1000000n, decimals: 6 },
        { amount: 1000000000000000000n, decimals: 18 }
      )
    ).toBe(0)
  })
})

describe("adjustDecimals", () => {
  it("should return same amount when decimals are equal", () => {
    expect(adjustDecimals(1000000n, 6, 6)).toBe(1000000n)
    expect(adjustDecimals(1000000000000000000n, 18, 18)).toBe(
      1000000000000000000n
    )
  })

  it("should scale up when target decimals are higher", () => {
    // 1.0 with 6 decimals to 18 decimals
    expect(adjustDecimals(1000000n, 6, 18)).toBe(1000000000000000000n)
    // 0.5 with 6 decimals to 18 decimals
    expect(adjustDecimals(500000n, 6, 18)).toBe(500000000000000000n)
  })

  it("should scale down when target decimals are lower", () => {
    // 1.0 with 18 decimals to 6 decimals
    expect(adjustDecimals(1000000000000000000n, 18, 6)).toBe(1000000n)
    // 0.5 with 18 decimals to 6 decimals
    expect(adjustDecimals(500000000000000000n, 18, 6)).toBe(500000n)
  })
})

describe("addAmounts", () => {
  it("should add amounts with same decimals", () => {
    expect(
      addAmounts({ amount: 100n, decimals: 18 }, { amount: 200n, decimals: 18 })
    ).toEqual({
      amount: 300n,
      decimals: 18,
    })
  })

  it("should add amounts with different decimals", () => {
    expect(
      addAmounts(
        { amount: 1000000n, decimals: 6 }, // 1.0
        { amount: 1000000000000000000n, decimals: 18 } // 1.0
      )
    ).toEqual({
      amount: 2000000000000000000n,
      decimals: 18,
    })
  })

  it("should add multiple amounts", () => {
    expect(
      addAmounts(
        { amount: 1000000n, decimals: 6 }, // 1.0
        { amount: 1000000000000000000n, decimals: 18 }, // 1.0
        { amount: 500000n, decimals: 6 } // 0.5
      )
    ).toEqual({
      amount: 2500000000000000000n,
      decimals: 18,
    })
  })
})

describe("subtractAmounts", () => {
  it("should subtract amounts with same decimals", () => {
    expect(
      subtractAmounts(
        { amount: 300n, decimals: 18 },
        { amount: 100n, decimals: 18 }
      )
    ).toEqual({
      amount: 200n,
      decimals: 18,
    })
  })

  it("should subtract amounts with different decimals", () => {
    expect(
      subtractAmounts(
        { amount: 2000000n, decimals: 6 }, // 2.0
        { amount: 1000000000000000000n, decimals: 18 } // 1.0
      )
    ).toEqual({
      amount: 1000000000000000000n,
      decimals: 18,
    })
  })
})

describe("computeTotalDeltaDifferentDecimals", () => {
  const tokens: BaseTokenInfo[] = [
    {
      defuseAssetId: "token1",
      address: "0x123",
      symbol: "TKN1",
      name: "Token1",
      decimals: 6,
      icon: "icon1.png",
      chainId: "",
      chainIcon: "chain1.png",
      chainName: "eth",
      routes: [],
    },
    {
      defuseAssetId: "token2",
      address: "0x456",
      symbol: "TKN2",
      name: "Token2",
      decimals: 18,
      icon: "icon2.png",
      chainId: "",
      chainIcon: "chain2.png",
      chainName: "eth",
      routes: [],
    },
  ]

  it("should compute total delta with same token", () => {
    const deltas: [string, bigint][] = [
      ["token1", 1000000n], // +1.0 (6 decimals)
      ["token1", -500000n], // -0.5 (6 decimals)
    ]

    expect(
      computeTotalDeltaDifferentDecimals(tokens.slice(0, 1), deltas)
    ).toEqual({
      amount: 500000n,
      decimals: 6,
    })
  })

  it("should compute total delta with different tokens and decimals", () => {
    const deltas: [string, bigint][] = [
      ["token1", 1000000n], // +1.0 (6 decimals)
      ["token2", 1000000000000000000n], // +1.0 (18 decimals)
    ]

    expect(computeTotalDeltaDifferentDecimals(tokens, deltas)).toEqual({
      amount: 2000000000000000000n,
      decimals: 18,
    })
  })

  it("should handle empty deltas", () => {
    expect(computeTotalDeltaDifferentDecimals(tokens, [])).toEqual({
      amount: 0n,
      decimals: 0,
    })
  })

  it("should handle unknown tokens", () => {
    const deltas: [string, bigint][] = [
      ["unknown", 1000000n],
      ["token1", 1000000n],
    ]

    expect(computeTotalDeltaDifferentDecimals(tokens, deltas)).toEqual({
      amount: 1000000000000000000n,
      decimals: 18,
    })
  })
})

describe("getUnderlyingBaseTokenInfos", () => {
  const baseToken: BaseTokenInfo = {
    defuseAssetId: "token1",
    address: "0x123",
    symbol: "TKN1",
    name: "Token1",
    decimals: 6,
    icon: "icon1.png",
    chainId: "",
    chainIcon: "chain1.png",
    chainName: "eth",
    routes: [],
  }

  const unifiedToken: UnifiedTokenInfo = {
    unifiedAssetId: "unified1",
    symbol: "UTKN",
    name: "Unified Token",
    icon: "icon.png",
    groupedTokens: [
      baseToken,
      {
        defuseAssetId: "token2",
        address: "0x456",
        symbol: "TKN2",
        name: "Token2",
        decimals: 18,
        icon: "icon2.png",
        chainId: "2",
        chainIcon: "chain2.png",
        chainName: "base",
        routes: [],
      },
    ],
  }

  it("should return array with single token for base token input", () => {
    expect(getUnderlyingBaseTokenInfos(baseToken)).toEqual([baseToken])
  })

  it("should return all grouped tokens for unified token input", () => {
    const result = getUnderlyingBaseTokenInfos(unifiedToken)
    expect(result).toHaveLength(2)
    expect(result).toEqual(unifiedToken.groupedTokens)
  })

  it("should return input array for token array input", () => {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const tokens = [baseToken, unifiedToken.groupedTokens[1]!]
    expect(getUnderlyingBaseTokenInfos(tokens)).toEqual(tokens)
  })

  it("should deduplicate tokens", () => {
    const tokensWithDuplicate = [
      baseToken,
      baseToken,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      unifiedToken.groupedTokens[1]!,
    ]
    const result = getUnderlyingBaseTokenInfos(tokensWithDuplicate)
    expect(result).toHaveLength(2)
    expect(result).toEqual([baseToken, unifiedToken.groupedTokens[1]])
  })

  it("should throw on duplicate tokens with different decimals", () => {
    const duplicateToken = { ...baseToken, decimals: 18 }
    const tokensWithConflict = [baseToken, duplicateToken]
    expect(() => getUnderlyingBaseTokenInfos(tokensWithConflict)).toThrow(
      DuplicateTokenError
    )
  })
})

describe("accountSlippage", () => {
  type Delta = [string, bigint][]

  it("should apply slippage to positive amounts", () => {
    const delta: Delta = [["token1", 1000n]]
    const slippageBasisPoints = 100 // 1%
    expect(accountSlippage(delta, slippageBasisPoints)).toEqual([
      ["token1", 990n],
    ])
  })

  it("should not apply slippage to zero amounts", () => {
    const delta: Delta = [["token1", 0n]]
    const slippageBasisPoints = 100 // 1%
    expect(accountSlippage(delta, slippageBasisPoints)).toEqual([
      ["token1", 0n],
    ])
  })

  it("should not apply slippage to negative amounts", () => {
    const delta: Delta = [["token1", -1000n]]
    const slippageBasisPoints = 100 // 1%
    expect(accountSlippage(delta, slippageBasisPoints)).toEqual([
      ["token1", -1000n],
    ])
  })

  it("should handle multiple tokens with mixed amounts", () => {
    const delta: Delta = [
      ["token1", 1000n],
      ["token2", -500n],
      ["token3", 0n],
    ]
    const slippageBasisPoints = 100 // 1%
    expect(accountSlippage(delta, slippageBasisPoints)).toEqual([
      ["token1", 990n],
      ["token2", -500n],
      ["token3", 0n],
    ])
  })

  it("should handle slippage of 0%", () => {
    const delta: Delta = [["token1", 1000n]]
    const slippageBasisPoints = 0 // 0%
    expect(accountSlippage(delta, slippageBasisPoints)).toEqual([
      ["token1", 1000n],
    ])
  })

  it("should handle slippage of 100%", () => {
    const delta: Delta = [["token1", 1000n]]
    const slippageBasisPoints = 10000 // 100%
    expect(accountSlippage(delta, slippageBasisPoints)).toEqual([
      ["token1", 0n],
    ])
  })
})
