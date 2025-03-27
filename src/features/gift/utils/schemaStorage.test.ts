import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { GiftStorageSchema } from "./schemaStorage"

describe("GiftStorageSchema", () => {
  it("valid gift storage data", () => {
    const giftStorageData = {
      state: {
        gifts: {
          user1: [
            {
              giftId: "1",
              intentHashes: ["hash1", "hash2"],
              tokenDiff: {
                "nep141:usdc": 1000n,
              },
              token: {
                defuseAssetId: "nep141:usdc",
                address: "usdc",
                symbol: "USDC",
                name: "USD Coin",
                decimals: 6,
                icon: "https://example.com/usdc.png",
                chainIcon: "https://example.com/usdc.png",
                chainName: "near",
              },
              secretKey: "ed25519:secretKey",
              accountId: "accountId",
              message: "message",
              updatedAt: 1742910077547,
            },
          ],
        },
      },
    }
    const result = v.parse(GiftStorageSchema, giftStorageData)
    expect(result).toEqual(giftStorageData)
  })
})
