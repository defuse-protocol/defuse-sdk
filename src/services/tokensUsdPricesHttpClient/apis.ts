import { request } from "./runtime"
import type { TokensUsdPricesPayload } from "./types"

export async function tokens(): Promise<TokensUsdPricesPayload> {
  return (await request("/tokens")).json()
}
