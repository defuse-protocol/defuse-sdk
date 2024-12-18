export type TokenUsdPrices = {
  defuse_asset_id: string
  decimals: number
  blockchain: string
  symbol: string
  price: number
  price_updated_at: string
  contract_address: string
}

export type TokensUsdPricesPayload = {
  items: TokenUsdPrices[]
  skip: number
  take: number
  total: number
}
