import { describe, expect, it } from "vitest"
import type { SupportedChainName } from "../types/base"
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

  it("should validate Dogecoin addresses", () => {
    // Valid addresses
    expect(
      validateAddress("DPvG6Dk8cQRX7VauYbYHTxStD3kHZGBSda", "dogecoin")
    ).toBe(true)
    expect(
      validateAddress("A7c8eJJPkXYwHShzXRuBwpnnfwEcUSkdB4", "dogecoin")
    ).toBe(true)

    // Invalid addresses
    expect(
      // too long
      validateAddress("DPvG6Dk8cQRX7VauYbYHTxStD3kHZGBSdaXXX", "dogecoin")
    ).toBe(false)
    expect(
      // too short
      validateAddress("DPvG6", "dogecoin")
    ).toBe(false)
    expect(
      // wrong prefix
      validateAddress("9PvG6Dk8cQRX7VauYbYHTxStD3kHZGBSda", "dogecoin")
    ).toBe(false)
    expect(
      // invalid character
      validateAddress("DPvG6Dk8cQRX7VauYbYHTxStD3kHZGBS.a", "dogecoin")
    ).toBe(false)
  })

  it("should validate Zcash addresses", () => {
    const transparentAddress = "t1XJD5btQc9qHHzywPS8xhPbs2hbXGXWLFq"
    const shieldedAddress =
      "zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8jl04tak0d3mm47vdtahatqrlkngh9slya"
    const unifiedAddress =
      "u1pv2h74qrlq9k9uqh6xk5p6vyzgvj84h6jedxg9e6hfhske3xjqf27f2qsm2qz4t3zqnll98t9n60"
    expect(validateAddress(transparentAddress, "zcash")).toBe(true)
    expect(validateAddress(shieldedAddress, "zcash")).toBe(false)
    expect(validateAddress(unifiedAddress, "zcash")).toBe(false)
  })
})
