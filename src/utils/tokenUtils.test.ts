import { describe, expect, it } from "vitest"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import { computeTotalBalance } from "./tokenUtils"

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
