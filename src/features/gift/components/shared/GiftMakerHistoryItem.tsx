import {
  CheckCircle,
  Check as CheckIcon,
  Copy as CopyIcon,
  Trash as TrashIcon,
} from "@phosphor-icons/react"
import { IconButton } from "@radix-ui/themes"
import { useContext } from "react"
import type { SignerCredentials } from "src/core/formatters"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import { Copy } from "../../../../components/IntentCard/CopyButton"
import { GiftClaimActorContext } from "../../providers/GiftClaimActorProvider"
import type { TabType } from "../../providers/TabProvider"
import type { GiftMakerHistory } from "../../stores/giftMakerHistory"
import type { GiftPayload } from "../../types/sharedTypes"
import { GiftStrip } from "../GiftStrip"

export function GiftMakerHistoryItem({
  giftInfo,
  generateLink,
  tag,
  signerCredentials,
}: {
  giftInfo: GiftMakerHistory
  generateLink: (giftPayload: GiftPayload) => string
  tag: TabType
  signerCredentials: SignerCredentials
}) {
  const amount = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftInfo.token),
    giftInfo.tokenDiff,
    { strict: false }
  )

  const { cancelGift } = useContext(GiftClaimActorContext)

  return (
    <div className="flex justify-between gap-2.5 bg-gray-3 rounded-lg p-3">
      {amount != null && (
        <GiftStrip
          token={giftInfo.token}
          amount={{
            amount: amount.amount,
            decimals: amount.decimals,
          }}
        />
      )}
      <div className="flex gap-2">
        {tag === "pending" && (
          <>
            <Copy
              text={() =>
                generateLink({
                  secretKey: giftInfo.secretKey,
                  message: giftInfo.message,
                })
              }
            >
              {(copied) => (
                <IconButton
                  type="button"
                  variant="outline"
                  color="gray"
                  className="rounded-lg"
                >
                  <div className="flex gap-2 items-center">
                    {copied ? (
                      <CheckIcon weight="bold" />
                    ) : (
                      <CopyIcon weight="bold" />
                    )}
                  </div>
                </IconButton>
              )}
            </Copy>
            <IconButton
              type="button"
              onClick={() => {
                cancelGift({
                  giftInfo: giftInfo,
                  signerCredentials: signerCredentials,
                })
              }}
              variant="outline"
              color="gray"
              className="rounded-lg"
            >
              <TrashIcon weight="bold" />
            </IconButton>
          </>
        )}
        {tag === "history" && (
          <div className="flex gap-1 items-center">
            <CheckCircle width={12} height={12} className="text-accent-11" />
            <span className="text-xs font-medium text-accent-11">Claimed</span>
          </div>
        )}
      </div>
    </div>
  )
}
