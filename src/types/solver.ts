export interface TokenEntity {
  defuse_asset_id: string
  decimals: number
  asset_name: string
  metadata_link: string
  routes_to: string[]
}
export interface Result<T> {
  result: T
}

export type SupportedTokens = Result<{ tokens: TokenEntity[] }>

export enum TransactionMethod {
  NATIVE_ON_TRANSFER = "native_on_transfer",
  FT_TRANSFER_CALL = "ft_transfer_call",
  ROLLBACK_INTENT = "rollback_intent",
  STORAGE_DEPOSIT = "storage_deposit",
  NEAR_DEPOSIT = "near_deposit",
  NEAR_WITHDRAW = "near_withdraw",
}
