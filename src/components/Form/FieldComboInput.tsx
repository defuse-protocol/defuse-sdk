import { Skeleton } from "@radix-ui/themes"
import clsx from "clsx"
import { useRef } from "react"
import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form"
import { formatUnits } from "viem"
import useMergedRef from "../../hooks/useMergedRef"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../types/base"
import {
  BlockMultiBalances,
  type BlockMultiBalancesProps,
} from "../Block/BlockMultiBalances"
import { SelectAssets } from "../SelectAssets"

interface Props<T extends FieldValues>
  extends Omit<BlockMultiBalancesProps, "decimals" | "balance"> {
  fieldName: Path<T>
  register?: UseFormRegister<T>
  required?: boolean
  min?: RegisterOptions["min"]
  max?: RegisterOptions["max"]
  placeholder?: string
  balance?: TokenValue
  transitBalance?: bigint
  selected?: BaseTokenInfo | UnifiedTokenInfo
  handleSelect?: () => void
  className?: string
  errors?: FieldErrors
  usdAmount?: string | null
  disabled?: boolean
  isLoading?: boolean
}

export const FieldComboInputRegistryName = "FieldComboInput"

export const FieldComboInput = <T extends FieldValues>({
  fieldName,
  register,
  required,
  min,
  max,
  placeholder = "0",
  balance,
  transitBalance,
  selected,
  handleSelect,
  className,
  errors,
  usdAmount,
  disabled,
  isLoading,
}: Props<T>) => {
  if (!register) {
    return null
  }

  const inputRef = useRef<HTMLInputElement>(null)

  const setInputValue = (
    value: string | ((previousValue: string) => string)
  ) => {
    if (inputRef.current) {
      const lastValue = inputRef.current.value

      inputRef.current.value =
        typeof value === "function" ? value(lastValue) : value

      // @ts-expect-error React hack for emitting change event
      const tracker = inputRef.current._valueTracker
      if (tracker) {
        tracker.setValue(lastValue)
      }

      const event = new Event("change", { bubbles: true })
      inputRef.current.dispatchEvent(event)
    }
  }

  const handleSetMaxValue = () => {
    if (!disabled && balance != null && selected && inputRef.current) {
      setInputValue(formatUnits(balance.amount, balance.decimals))
    }
  }

  // react-hook-form specific props
  const reactHookFormRegisterProps = register(fieldName, {
    min,
    max,
    pattern: {
      value: /^[0-9]*[,.]?[0-9]*$/, // Valid result "10", "1,0", "0.01", ".01"
      message: "Please enter a valid number",
    },
    required: required ? "This field is required" : false,
  })

  const allInputRefs = useMergedRef(inputRef, reactHookFormRegisterProps.ref)
  const fieldError = errors?.[fieldName]
  return (
    <div
      className={clsx(
        "relative flex flex-col px-5 pt-5 pb-6 w-full bg-gray-50 dark:bg-black-900 dark:border-black-950",
        className
      )}
    >
      <div className="flex justify-between items-center gap-2 h-15">
        {isLoading && <Skeleton className="w-full" height="40px" />}
        <div className="relative flex flex-1 overflow-hidden">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[,.]?[0-9]*"
            {...reactHookFormRegisterProps}
            ref={allInputRefs}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={clsx(
              "bg-gray-50 w-full text-3xl font-medium placeholder-black border-transparent focus:border-transparent focus:ring-0 dark:bg-black-900 dark:placeholder-white px-0",
              disabled &&
                "text-black-200 pointer-events-none placeholder-black-200",
              {
                hidden: isLoading,
              }
            )}
          />
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-gray-2" />
        </div>

        {selected && (
          <SelectAssets selected={selected} handleSelect={handleSelect} />
        )}
      </div>

      <div className="flex justify-between items-center min-h-6 gap-2 min-w-0">
        <div className="relative flex flex-1 overflow-hidden whitespace-nowrap">
          {fieldError ? (
            <span className="text-xs sm:text-sm font-medium text-red-400">
              {(fieldError as FieldError).message}
            </span>
          ) : usdAmount ? (
            <span className="text-xs sm:text-sm font-medium text-gray-400">
              {usdAmount}
            </span>
          ) : null}
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-gray-2" />
        </div>

        {balance != null && (
          <BlockMultiBalances
            balance={balance.amount}
            decimals={balance.decimals}
            handleClick={handleSetMaxValue}
            disabled={disabled}
            className="ml-auto"
            transitBalance={transitBalance}
          />
        )}
      </div>
    </div>
  )
}

FieldComboInput.displayName = FieldComboInputRegistryName
