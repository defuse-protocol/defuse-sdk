import { base58, hex } from "@scure/base"
import type { ChainType } from "../types/deposit"

// Branding a string type with a unique symbol to prevent accidental misuse.
export type DefuseUserId = string & { __brand: "DefuseAccountId" }

/**
 * Any valid Near account ID can be used as a Defuse user ID.
 * Near accounts are lowercased and have a maximum length of 64 characters.
 * Examples of valid Near account IDs:
 * - explicit Near account: "bob.near"
 * - implicit Near account: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
 * - Ethereum address: "0xc0ffee254729296a45a3885639ac7e10f9d54979"
 * - Solana address: "3yAnWiDUbv2Ckjptk1D1HAwYHgqZKoqbR755ckY3n9oV"
 */
export function userAddressToDefuseUserId(
  userAddress: string,
  addressChainType: ChainType
): DefuseUserId {
  switch (addressChainType) {
    case "evm":
    case "near":
      return userAddress.toLowerCase() as DefuseUserId

    case "solana":
      return hex.encode(base58.decode(userAddress)) as DefuseUserId
  }
}
