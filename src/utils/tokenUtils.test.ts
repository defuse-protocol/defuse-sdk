import { describe, expect, it } from "vitest"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import { computeTotalBalance } from "./tokenUtils"

describe("computeTotalBalance", () => {
  it("should return balance for base token", () => {
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

    const balances = {
      token1: 100n,
    }

    expect(computeTotalBalance(baseToken, balances)).toBe(100n)
    expect(computeTotalBalance(baseToken, {})).toBeUndefined()
  })

  it("should sum balances for unified token", () => {
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

    expect(
      computeTotalBalance(unifiedToken, {
        token1: 100n,
        token2: 200n,
      })
    ).toBe(300n)

    expect(
      computeTotalBalance(unifiedToken, {
        token1: 100n,
      })
    ).toBe(100n)

    expect(computeTotalBalance(unifiedToken, {})).toBeUndefined()
  })
})
