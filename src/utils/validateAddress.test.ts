import { describe, expect, it } from "vitest"
import type { SupportedChainName } from "../types"
import { validateAddress } from "./validateAddress"

describe("validateAddress", () => {
  it("should validate NEAR addresses", () => {
    expect(validateAddress("valid.near", "near")).toBe(true)
    expect(validateAddress("invalid_near-", "near")).toBe(false)
  })

  it.each(["eth", "base", "arbitrum"] as SupportedChainName[])(
    "should validate %s addresses",
    (chainName) => {
      expect(
        validateAddress("0x32Be343B94f860124dC4fEe278FDCBD38C102D88", chainName)
      ).toBe(true)
      expect(
        validateAddress("0x32Be343B94f860124dC4fEe278FDCBD38C102D8Z", chainName)
      ).toBe(false)
      expect(
        validateAddress("32Be343B94f860124dC4fEe278FDCBD38C102D88", chainName)
      ).toBe(false)
    }
  )

  it.each([
    // Taproot address - P2TR
    "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297",
    // SegWit address - P2WPKH
    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    // Script address - P2SH
    "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
    // Legacy address - P2PKH
    "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
  ])("should validate Bitcoin addresses", (addr) => {
    expect(validateAddress(addr, "bitcoin")).toBe(true)
  })

  it("should return false for invalid Bitcoin address", () => {
    expect(validateAddress("invalidBitcoinAddress", "bitcoin")).toBe(false)
  })

  it("should return false for unsupported blockchains", () => {
    expect(
      validateAddress(
        "someAddress",
        "unsupportedBlockchain" as SupportedChainName
      )
    ).toBe(false)
  })

  it("should validate Solana addresses", () => {
    expect(
      validateAddress("6iTpVEx7Ye6wvvrnXBLf6FPhENrCu8mKGswzhem2pJ1m", "solana")
    ).toBe(true)
    expect(validateAddress("invalidSolanaAddress", "solana")).toBe(false)
  })
})
