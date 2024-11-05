import { describe, expect, it } from "vitest"
import { validateAddress } from "./validateAddress"

describe("validateAddress", () => {
  it("should validate NEAR addresses", () => {
    expect(validateAddress("valid.near", "near")).toBe(true)
    expect(validateAddress("invalid_near-", "near")).toBe(false)
  })

  it.each(["eth", "base", "arbitrum"])(
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

  it("should validate Bitcoin addresses", () => {
    expect(
      validateAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "bitcoin")
    ).toBe(true)
    expect(
      validateAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "bitcoin")
    ).toBe(true)
    expect(validateAddress("invalidBitcoinAddress", "bitcoin")).toBe(false)
  })

  it("should return false for unsupported blockchains", () => {
    expect(validateAddress("someAddress", "unsupportedBlockchain")).toBe(false)
  })
})
