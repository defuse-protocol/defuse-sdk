import type { CheckedState } from "@radix-ui/react-checkbox"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Checkbox, Flex, Text, Tooltip } from "@radix-ui/themes"
import clsx from "clsx"
import { formatTokenValue } from "../../../utils/format"
import styles from "./styles.module.css"

export interface BlockMultiBalancesProps {
  balance: bigint
  decimals: number
  withNativeSupport?: boolean
  nativeSupportChecked?: CheckedState
  handleIncludeNativeToSwap?: (checked: CheckedState) => void
  handleClick?: () => void
  disabled?: boolean
  className?: string
}

export const BlockMultiBalances = ({
  balance,
  decimals,
  withNativeSupport,
  nativeSupportChecked = false,
  handleIncludeNativeToSwap,
  handleClick,
  disabled,
  className,
}: BlockMultiBalancesProps) => {
  const active = balance > 0n && !disabled

  return (
    <Flex
      gap={"1"}
      asChild
      className={clsx(styles.balanceContainer, className)}
    >
      <button type={"button"} onClick={handleClick} disabled={!active}>
        {active ? (
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
        <span
          className={clsx(
            "text-xs px-2 py-0.5 rounded-full",
            active
              ? "bg-red-100 text-red-400 dark:bg-red-200 dark:text-primary-400"
              : "bg-white-200 text-gray-600"
          )}
        >
          {formatTokenValue(balance, decimals, {
            min: 0.0001,
            fractionDigits: 4,
          })}
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
      </button>
    </Flex>
  )
}
