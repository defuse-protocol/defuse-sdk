import type { DefuseUserId } from "src/utils/defuse"
import type { GiftMakerHistory } from "../stores/giftMakerHistory"

export type GiftData = {
  state: {
    gifts: Record<DefuseUserId, GiftMakerHistory[]>
  }
}

export function serializeGiftData(data: GiftData) {
  return {
    ...data,
    state: {
      ...data.state,
      gifts: Object.fromEntries(
        Object.entries(data.state.gifts).map(([key, value]) => [
          key,
          value.map((g) => ({
            ...g,
            tokenDiff: Object.fromEntries(
              Object.entries(g.tokenDiff).map(([key, value]) => [
                key,
                typeof value === "bigint" ? String(value) : value,
              ])
            ),
          })),
        ])
      ),
    },
  }
}

export function deserializeGiftData(data: GiftData) {
  return {
    ...data,
    state: {
      ...data.state,
      gifts: Object.fromEntries(
        Object.entries(data.state.gifts).map(([key, value]) => [
          key,
          value.map((g) => ({
            ...g,
            tokenDiff: Object.fromEntries(
              Object.entries(g.tokenDiff).map(([key, value]) => [
                key,
                typeof value === "string" ? BigInt(value) : value,
              ])
            ),
          })),
        ])
      ),
    },
  }
}
