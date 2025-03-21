import { WidgetRoot } from "../../../components/WidgetRoot"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { useWatchHoldings } from "../hooks/useWatchHoldings"
import { computeTotalUsdValue } from "../utils/holdingsUtils"
import { HoldingsIsland } from "./HoldingsIsland"
import { SummaryIsland } from "./SummaryIsland"

export interface AccountWidgetProps {
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  depositHref: string
  withdrawHref: string
  giftHref: string
}

export function AccountWidget({
  tokenList,
  userAddress,
  userChainType,
  depositHref,
  withdrawHref,
  giftHref,
}: AccountWidgetProps) {
  const userId =
    userAddress != null && userChainType != null
      ? userAddressToDefuseUserId(userAddress, userChainType)
      : null

  const holdings = useWatchHoldings({ userId, tokenList })
  const totalValueUsd = holdings ? computeTotalUsdValue(holdings) : undefined

  return (
    <WidgetRoot>
      <div className="widget-container flex flex-col gap-5">
        <SummaryIsland
          isLoggedIn={userAddress != null}
          valueUsd={totalValueUsd}
          depositHref={depositHref}
          withdrawHref={withdrawHref}
          giftHref={giftHref}
        />

        <HoldingsIsland isLoggedIn={userId != null} holdings={holdings} />
      </div>
    </WidgetRoot>
  )
}
