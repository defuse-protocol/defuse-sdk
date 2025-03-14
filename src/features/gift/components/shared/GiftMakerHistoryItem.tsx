import { Check as CheckIcon, Copy as CopyIcon } from "@phosphor-icons/react"
import { Button } from "@radix-ui/themes"
import { Copy } from "../../../../components/IntentCard/CopyButton"
import type { GiftMakerHistory } from "../../stores/giftMakerHistory"
import { GiftStrip } from "../GiftStrip"

export function GiftMakerHistoryItem({
  gift,
  generateLink,
}: {
  gift: GiftMakerHistory
  generateLink: (secretKey: string) => string
}) {
  return (
    <div className="flex justify-between gap-2.5">
      <GiftStrip
        token={gift.token}
        amount={{
          amount: BigInt(gift.amount),
          decimals: gift.decimals,
        }}
      />
      <Copy text={() => generateLink(gift.escrowCredentials.NEP413.secretKey)}>
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
