import { Gift, PaperPlaneRight, Plus } from "@phosphor-icons/react"
import { Skeleton } from "@radix-ui/themes"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { FormattedCurrency } from "./shared/FormattedCurrency"
import { Island } from "./shared/Island"
import { IslandHeader } from "./shared/IslandHeader"
import { NavButton } from "./shared/NavButton"

export function SummaryIsland({
  isLoggedIn,
  valueUsd,
  depositHref,
  withdrawHref,
  giftHref,
  onSignInRequest,
}: {
  isLoggedIn: boolean
  valueUsd: number | undefined
  depositHref: string
  withdrawHref: string
  giftHref: string
  onSignInRequest: () => void
}) {
  valueUsd = isLoggedIn ? valueUsd : 0

  return (
    <Island className="flex flex-col gap-8">
      <IslandHeader
        heading="Account"
        rightSlot={
          null
          // It will be added in the future
          // <Button
          //   variant="soft"
          //   color="gray"
          //   radius="full"
          //   className="font-bold text-gray-12"
          // >
          //   <IntentsIcon className="rounded-full" />
          //   Reveal address <Eye weight="bold" />
          // </Button>
        }
      />

      <div className="flex flex-col gap-2">
        {valueUsd != null ? (
          <FormattedCurrency
            value={valueUsd}
            formatOptions={{ currency: "USD" }}
            className="text-[40px] leading-none tracking-tight font-black"
            centsClassName="text-[32px]"
          />
        ) : (
          <div>
            <Skeleton className="text-[40px] leading-none">$1000.00</Skeleton>
          </div>
        )}
        <div className="text-sm font-medium text-gray-11">
          Deposited balance
        </div>
      </div>

      {isLoggedIn ? (
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
          {!!giftHref && (
            <NavButton
              href={giftHref}
              className="flex-1"
              variant="secondary"
              label="Gift"
              icon={<Gift weight="bold" className="size-5" />}
            />
          )}
        </div>
      ) : (
        <ButtonCustom type="button" size="lg" onClick={() => onSignInRequest()}>
          Sign in
        </ButtonCustom>
      )}
    </Island>
  )
}
