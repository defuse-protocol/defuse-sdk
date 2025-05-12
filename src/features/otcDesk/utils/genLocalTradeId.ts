import { customAlphabet } from "nanoid"

/**
 * Gives short and unique trade id, shouldn't be used for any serious persistence purposes.
 * Note: Collisions are possible, use it only for temporary local identification.
 */
export function genLocalTradeId(multiPayloadPlain: string): string {
  const hash = dfjb2(multiPayloadPlain)
  return Math.abs(hash).toString(16).padStart(8, "0")
}

/**
 * Quick and simple hash algorithm
 */
function dfjb2(str: string) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) + hash + char // hash * 33 + char
  }
  return hash
}

/**
 * Using only lowercase letters, numbers, and hyphen for maximum URL-friendliness
 *
 * Collision probability:
 * - With 25 characters and 37 possible characters: 37^25 ≈ 2.8 × 10^39 possible combinations
 * - Even with 1 billion IDs generated, the probability of a collision is less than 1 in 10^30
 */
export function genTradeId(): string {
  return customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789-", 25)()
}
