import type { CheckedState } from "@radix-ui/react-checkbox"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Checkbox, Text, Tooltip } from "@radix-ui/themes"
import clsx from "clsx"
import React from "react"
import { formatUnits } from "viem"

export interface BlockMultiBalancesProps {
  balance: bigint
  decimals: number
  withNativeSupport?: boolean
  nativeSupportChecked?: CheckedState
  handleIncludeNativeToSwap?: (checked: CheckedState) => void
  handleClick?: () => void
}

export const BlockMultiBalances = ({
  balance,
  decimals,
  withNativeSupport,
  nativeSupportChecked = false,
  handleIncludeNativeToSwap,
  handleClick,
}: BlockMultiBalancesProps) => {
  return (
    <div className="absolute bottom-4 right-5 flex justify-center items-center gap-2">
      {balance > 0n ? (
        <img
          src="/static/icons/wallet_active.svg"
          alt="Balance"
          width={16}
          height={16}
        />
      ) : (
        <img
          src="/static/icons/wallet_no_active.svg"
          alt={"Balance"}
          width={16}
          height={16}
        />
      )}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: sorry keyboard users */}
      <span
        onClick={handleClick}
        className={clsx(
          "text-xs px-2 py-0.5 rounded-full",
          balance > 0n
            ? "bg-red-100 text-red-400 dark:bg-red-200 dark:text-primary-400"
            : "bg-white-200 text-gray-600",
          handleClick && "cursor-pointer"
        )}
      >
        {formatUnits(balance, decimals)}
      </span>
      {withNativeSupport && (
        <div className="absolute -top-[74px] right-0 flex justify-center items-center gap-1">
          <Checkbox
            size="1"
            checked={nativeSupportChecked ?? false}
            onCheckedChange={
              handleIncludeNativeToSwap ? handleIncludeNativeToSwap : () => {}
            }
            color="orange"
          />
          <Text size="1" className="text-gray-600 text-nowrap">
            Use Native
          </Text>
          <Tooltip content="Your NEAR balance will be automatically wrapped to wNEAR if your wNEAR balance isn't sufficient for the swap">
            <InfoCircledIcon />
          </Tooltip>
        </div>
      )}
    </div>
  )
}
