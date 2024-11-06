// Branding a string type with a unique symbol to prevent accidental misuse.
export type DefuseUserId = string & { __brand: "DefuseAccountId" }

/**
 * Any valid Near account ID can be used as a Defuse user ID.
 * Near accounts are lowercased and have a maximum length of 64 characters.
 * Examples of valid Near account IDs:
 * - explicit Near account: "bob.near"
 * - implicit Near account: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
 * - Ethereum address "0xc0ffee254729296a45a3885639ac7e10f9d54979"
 */
export function userAddressToDefuseUserId(userAddress: string): DefuseUserId {
  return userAddress.toLowerCase() as DefuseUserId
}
