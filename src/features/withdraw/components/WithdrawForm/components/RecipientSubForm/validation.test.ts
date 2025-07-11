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

    it("should accept different valid NEAR address than user's", () => {
      const result = validateAddressSoft(
        "different.near",
        "near_intents",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })
  })

  describe("EVM network (smoke test)", () => {
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

    it("should reject invalid NEAR address", () => {
      const result = validateAddressSoft(
        "invalid_near-",
        "near",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
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
    it("should accept valid Bitcoin legacy address", () => {
      const result = validateAddressSoft(
        "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
        "bitcoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Bitcoin SegWit address", () => {
      const result = validateAddressSoft(
        "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
        "bitcoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Bitcoin P2SH address", () => {
      const result = validateAddressSoft(
        "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
        "bitcoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Bitcoin Taproot address", () => {
      const result = validateAddressSoft(
        "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297",
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

  describe("Dogecoin network", () => {
    it("should accept valid Dogecoin address starting with D", () => {
      const result = validateAddressSoft(
        "DPvG6Dk8cQRX7VauYbYHTxStD3kHZGBSda",
        "dogecoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Dogecoin address starting with A", () => {
      const result = validateAddressSoft(
        "A7c8eJJPkXYwHShzXRuBwpnnfwEcUSkdB4",
        "dogecoin",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Dogecoin address", () => {
      const result = validateAddressSoft(
        "invalidDogecoinAddress",
        "dogecoin",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("XRP Ledger network", () => {
    it("should accept valid XRP classic address", () => {
      const result = validateAddressSoft(
        "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        "xrpledger",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid XRP X-address", () => {
      const result = validateAddressSoft(
        "X7AcgcsBL6XDcUb289X4mJ8djcdyKaB5hJDWMArnXr61cqZ",
        "xrpledger",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid XRP address", () => {
      const result = validateAddressSoft(
        "invalidXRPAddress",
        "xrpledger",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Zcash network", () => {
    it("should accept valid Zcash transparent address (t1)", () => {
      const result = validateAddressSoft(
        "t1a7w3qM23i4ajQcbX5wdKoAk7bxzqrGqXp",
        "zcash",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Zcash transparent address (t3)", () => {
      const result = validateAddressSoft(
        "t3a7w3qM23i4ajQcbX5wdKoAk7bxzqrGqXp",
        "zcash",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Zcash address", () => {
      const result = validateAddressSoft(
        "invalidZcashAddress",
        "zcash",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Tron network", () => {
    it("should accept valid Tron base58 address", () => {
      const result = validateAddressSoft(
        "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
        "tron",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Tron hex address", () => {
      const result = validateAddressSoft(
        "41a614f803b6fd780986a42c78ec9c7f77e6ded13c",
        "tron",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Tron address", () => {
      const result = validateAddressSoft(
        "invalidTronAddress",
        "tron",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("TON network", () => {
    it("should accept valid TON address starting with E", () => {
      const result = validateAddressSoft(
        "EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t",
        "ton",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid TON address starting with U", () => {
      const result = validateAddressSoft(
        "UQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t",
        "ton",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid TON address", () => {
      const result = validateAddressSoft(
        "invalidTONAddress",
        "ton",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Sui network", () => {
    it("should accept valid Sui address with 0x prefix", () => {
      const result = validateAddressSoft(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "sui",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should accept valid Sui address without 0x prefix", () => {
      const result = validateAddressSoft(
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "sui",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Sui address", () => {
      const result = validateAddressSoft(
        "invalidSuiAddress",
        "sui",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Stellar network", () => {
    it("should accept valid Stellar address", () => {
      const result = validateAddressSoft(
        "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
        "stellar",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Stellar address", () => {
      const result = validateAddressSoft(
        "invalidStellarAddress",
        "stellar",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })
  })

  describe("Aptos network", () => {
    it("should accept valid Aptos address", () => {
      const result = validateAddressSoft(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "aptos",
        testUserAddress,
        undefined
      )
      expect(result).toBeNull()
    })

    it("should reject invalid Aptos address", () => {
      const result = validateAddressSoft(
        "invalidAptosAddress",
        "aptos",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
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

    it("should handle very long invalid address", () => {
      const longAddress = `0x${"a".repeat(100)}`
      const result = validateAddressSoft(
        longAddress,
        "eth",
        testUserAddress,
        undefined
      )
      expect(result).toBe(
        "Please enter a valid address for the selected blockchain"
      )
    })

    it("should handle special characters in address", () => {
      const result = validateAddressSoft(
        "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b@",
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
