import { Check as CheckIcon, Copy as CopyIcon } from "@phosphor-icons/react"
import { Button } from "@radix-ui/themes"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import { Copy } from "../../../../components/IntentCard/CopyButton"
import type { GiftMakerHistory } from "../../stores/giftMakerHistory"
import type { GiftPayload } from "../../types/sharedTypes"
import { GiftStrip } from "../GiftStrip"

export function GiftMakerHistoryItem({
  giftInfo,
  generateLink,
}: {
  giftInfo: GiftMakerHistory
  generateLink: (giftPayload: GiftPayload) => string
}) {
  const amount = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftInfo.token),
    giftInfo.tokenDiff,
    { strict: false }
  )

  return (
    <div className="flex justify-between gap-2.5">
      {amount != null && (
        <GiftStrip
          token={giftInfo.token}
          amount={{
            amount: amount.amount,
            decimals: amount.decimals,
          }}
        />
      )}
      <Copy
        text={() =>
          generateLink({
            secretKey: giftInfo.secretKey,
            message: giftInfo.message,
          })
        }
      >
        {(copied) => (
          <Button type="button">
            <div className="flex gap-2 items-center">
              {copied ? (
                <CheckIcon weight="bold" />
              ) : (
                <CopyIcon weight="bold" />
              )}
            </div>
          </Button>
        )}
      </Copy>
    </div>
  )
}
