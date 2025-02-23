import { stringify } from "viem"
import type { ChainType } from "../../../types/deposit"
import type { SignMessage } from "../types/sharedTypes"
import type { TradeTerms } from "../utils/deriveTradeTerms"

export type OtcTakerFormProps = {
  tradeTerms: TradeTerms | null
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined
  signMessage: SignMessage
}

export function OtcTakerForm({ tradeTerms }: OtcTakerFormProps) {
  return <pre>{stringify(tradeTerms, null, 2)}</pre>
}
