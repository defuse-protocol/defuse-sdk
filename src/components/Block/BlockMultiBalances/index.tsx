import clsx from "clsx"
import { TooltipInfo } from "src/components/TooltipInfo"
import { formatTokenValue } from "../../../utils/format"

export interface BlockMultiBalancesProps {
  balance: bigint
  transitBalance?: bigint
  decimals: number
  handleClick?: () => void
  disabled?: boolean
  className?: string
}

export const BlockMultiBalances = ({
  balance,
  transitBalance,
  decimals,
  handleClick,
  disabled,
  className,
}: BlockMultiBalancesProps) => {
  const active = balance > 0n && !disabled
  return (
    <div className={clsx("flex gap-1", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!active}
        className="flex items-center gap-1"
      >
        <div
          className={clsx(
            "w-4 h-4  [mask-image:url(/static/icons/wallet_no_active.svg)] bg-no-repeat bg-contain",
            active ? "bg-accent-800" : "bg-gray-600/90"
          )}
        />
        <span
          className={clsx(
            "text-xs px-2 py-0.5 rounded-full font-bold",
            active
              ? "bg-accent-a200 text-accent-900"
              : "bg-gray-300/50 text-gray-600"
          )}
        >
          {formatTokenValue(balance, decimals, {
            min: 0.0001,
            fractionDigits: 4,
          })}
        </span>
      </button>
      {transitBalance ? (
        <TooltipInfo
          icon={
            <div className="flex items-center gap-1 rounded-full bg-gray-300/50 px-2 py-0.5">
              <div className="w-3 h-3 bg-[url('/static/images/process.gif')] bg-no-repeat bg-contain" />
              <span className="text-xs font-bold text-gray-600">
                {formatTokenValue(transitBalance, decimals, {
                  min: 0.0001,
                  fractionDigits: 4,
                })}
              </span>
            </div>
          }
        >
          Deposit is in progress and will be
          <br />
          available shortly.
        </TooltipInfo>
      ) : null}
    </div>
  )
}
