import { Eye, Gift, PaperPlaneRight, Plus } from "@phosphor-icons/react"
import { Button } from "@radix-ui/themes"
import { FormattedCurrency } from "./shared/FormattedCurrency"
import { IntentsIcon } from "./shared/IntentsIcon"
import { Island } from "./shared/Island"
import { IslandHeader } from "./shared/IslandHeader"
import { NavButton } from "./shared/NavButton"

export function SummaryIsland({
  valueUsd,
  depositHref,
  withdrawHref,
  giftHref,
}: {
  valueUsd: number
  depositHref: string
  withdrawHref: string
  giftHref: string
}) {
  return (
    <Island className="flex flex-col gap-8">
      <IslandHeader
        heading="Account"
        rightSlot={
          <Button
            variant="soft"
            color="gray"
            radius="full"
            className="font-bold text-gray-12"
          >
            <IntentsIcon className="rounded-full" />
            Reveal address <Eye weight="bold" />
          </Button>
        }
      />

      <div className="flex flex-col gap-2">
        <FormattedCurrency
          value={valueUsd}
          formatOptions={{ currency: "USD" }}
          className="text-[40px] leading-none tracking-tight font-black"
          centsClassName="text-[32px]"
        />
        <div className="text-sm font-medium text-gray-11">
          Deposited balance
        </div>
      </div>

      <div className="flex gap-4">
        <NavButton
          href={depositHref}
          className="flex-1"
          variant="primary"
          label="Deposit"
          icon={<Plus weight="bold" className="size-5" />}
        />
        <NavButton
          href={withdrawHref}
          className="flex-1"
          variant="secondary"
          label="Withdraw"
          icon={<PaperPlaneRight weight="bold" className="size-5" />}
        />
        <NavButton
          href={giftHref}
          className="flex-1"
          variant="secondary"
          label="Gift"
          icon={<Gift weight="bold" className="size-5" />}
        />
      </div>
    </Island>
  )
}
