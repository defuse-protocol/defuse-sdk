import { describe, expect, it } from "vitest"
import { userAddressToDefuseUserId } from "./defuse"

describe("userAddressToDefuseUserId", () => {
  it("returns lowercased Near account ID for 'near' chain type", () => {
    const result = userAddressToDefuseUserId("Bob.Near", "near")
    expect(result).toBe("bob.near")
  })

  it("returns lowercased Ethereum address for 'evm' chain type", () => {
    const result = userAddressToDefuseUserId(
      "0xc0ffee254729296a45a3885639AC7E10F9d54979",
      "evm"
    )
    expect(result).toBe("0xc0ffee254729296a45a3885639ac7e10f9d54979")
  })

  it("returns hex encoded Solana address for 'solana' chain type", () => {
    const result = userAddressToDefuseUserId(
      "3yAnWiDUbv2Ckjptk1D1HAwYHgqZKoqbR755ckY3n9oV",
      "solana"
    )
    expect(result).toBe(
      "2c1af676c3580b2ecde77673a38886cc16429b4b17744da5985a25152843a570"
    )
  })
})
