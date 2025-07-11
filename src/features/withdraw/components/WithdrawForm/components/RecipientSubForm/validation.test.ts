import { describe, expect, it } from "vitest"
import { AuthMethod } from "../../../../../../types"
import { validateAddressSoft } from "./validation"

describe("validateAddressSoft", () => {
  const testUserAddress = "0x32Be343B94f860124dC4fEe278FDCBD38C102D88"

  describe("near_intents network", () => {
    it("should return error when user tries to withdraw to their own address using passkey", () => {
      const result = validateAddressSoft(
        "0x5ff8d1644ec46f23f1e3981831ed2ec3dd40c2ca",
        "near_intents",
        "p256:3VdTe7trEqXYvipEe2EtJZC7vxgFo9HLn75CMFreiKKD1mSxH6M964Q8WxucQ5i92xL6oCDcg7yfUGS9S2oVi7Zb",
        AuthMethod.WebAuthn
      )
      expect(result).toBe(
        "You cannot withdraw to your own address. Please enter a different recipient address."
      )
    })

    it("should return error when user tries to withdraw to their own address", () => {
      const result = validateAddressSoft(
        testUserAddress,
        "near_intents",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "You cannot withdraw to your own address. Please enter a different recipient address."
      )
    })

    it("should return error when user tries to withdraw to their own address (case insensitive)", () => {
      const result = validateAddressSoft(
        testUserAddress.toLowerCase(),
        "near_intents",
        testUserAddress.toUpperCase(),
        undefined
      )
      expect(result).toBe(
        "You cannot withdraw to your own address. Please enter a different recipient address."
      )
    })

    it("should accept valid NEAR address", () => {
      const result = validateAddressSoft(
        "valid.near",
        "near_intents",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid NEAR address", () => {
      const result = validateAddressSoft(
        "invalid_near-",
        "near_intents",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("EVM networks", () => {
    it("should accept valid EVM address for eth", () => {
      const result = validateAddressSoft(
        "0x32Be343B94f860124dC4fEe278FDCBD38C102D88",
        "eth",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid EVM address for eth", () => {
      const result = validateAddressSoft(
        "0x32Be343B94f860124dC4fEe278FDCBD38C102D8Z",
        "eth",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("NEAR network", () => {
    it("should accept valid NEAR address", () => {
      const result = validateAddressSoft(
        "valid.near",
        "near",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept EVM address for NEAR network", () => {
      const result = validateAddressSoft(
        "0x32Be343B94f860124dC4fEe278FDCBD38C102D88",
        "near",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })
  })

  describe("Bitcoin network", () => {
    it("should accept valid Bitcoin address", () => {
      const result = validateAddressSoft(
        "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
        "bitcoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Bitcoin address", () => {
      const result = validateAddressSoft(
        "invalidBitcoinAddress",
        "bitcoin",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Solana network", () => {
    it("should accept valid Solana address", () => {
      const result = validateAddressSoft(
        "6iTpVEx7Ye6wvvrnXBLf6FPhENrCu8mKGswzhem2pJ1m",
        "solana",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Solana address", () => {
      const result = validateAddressSoft(
        "invalidSolanaAddress",
        "solana",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Other networks", () => {
    it("should accept valid Dogecoin address", () => {
      const result = validateAddressSoft(
        "DPvG6Dk8cQRX7VauYbYHTxStD3kHZGBSda",
        "dogecoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid XRP address", () => {
      const result = validateAddressSoft(
        "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        "xrpledger",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Zcash address", () => {
      const result = validateAddressSoft(
        "t1a7w3qM23i4ajQcbX5wdKoAk7bxzqrGqXp",
        "zcash",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Tron address", () => {
      const result = validateAddressSoft(
        "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
        "tron",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid TON address", () => {
      const result = validateAddressSoft(
        "EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t",
        "ton",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Sui address", () => {
      const result = validateAddressSoft(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "sui",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Stellar address", () => {
      const result = validateAddressSoft(
        "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
        "stellar",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Aptos address", () => {
      const result = validateAddressSoft(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "aptos",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })
  })

  describe("Edge cases", () => {
    it("should handle empty address", () => {
      const result = validateAddressSoft("", "eth", testUserAddress, undefined)
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })

    it("should handle whitespace-only address", () => {
      const result = validateAddressSoft(
        "   ",
        "eth",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })
})
