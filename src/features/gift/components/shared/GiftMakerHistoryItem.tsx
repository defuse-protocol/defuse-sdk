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
import type { GiftLinkData } from "../../types/sharedTypes"
import type { GiftInfo } from "../../utils/parseGiftInfos"
import { GiftStrip } from "../GiftStrip"

export function GiftMakerHistoryItem({
  giftInfo,
  generateLink,
  signerCredentials,
}: {
  giftInfo: GiftInfo
  generateLink: (giftLinkData: GiftLinkData) => string
  signerCredentials: SignerCredentials
}) {
  const amount = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftInfo.token),
    giftInfo.tokenDiff,
    { strict: false }
  )

  const { cancelGift } = useContext(GiftClaimActorContext)

  return (
    <div className="py-2.5 flex items-center justify-between gap-2.5">
      {amount != null && (
        <GiftStrip
          token={giftInfo.token}
          amountSlot={
            <GiftStrip.Amount token={giftInfo.token} amount={amount} />
          }
          dateSlot={<GiftStrip.Date updatedAt={giftInfo.updatedAt} />}
        />
      )}
      <div className="flex gap-2 items-center">
        {giftInfo.status === "pending" && (
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
        )}
        {giftInfo.status === "claimed" && (
          <div className="flex gap-1 items-center">
            <CheckCircle width={12} height={12} className="text-accent-11" />
            <span className="text-xs font-medium text-accent-11">Claimed</span>
          </div>
        )}
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
      </div>
    </div>
  )
}
