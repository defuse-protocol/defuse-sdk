import { Flex, Skeleton, Text } from "@radix-ui/themes"
import clsx from "clsx"
import type React from "react"
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
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
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
  label?: string | React.ReactNode
  price?: string
  balance?: bigint
  selected?: BaseTokenInfo | UnifiedTokenInfo
  handleSelect?: () => void
  className?: string
  errors?: FieldErrors
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
  label,
  price,
  balance,
  selected,
  handleSelect,
  className,
  errors,
  withNativeSupport,
  handleIncludeNativeToSwap,
  nativeSupportChecked,
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
      setInputValue(formatUnits(balance, selected.decimals))
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

  return (
    <div
      className={clsx(
        "relative flex flex-col px-5 pt-5 pb-10 w-full bg-gray-50 dark:bg-black-900 dark:border-black-950",
        className
      )}
    >
      <div className="w-full flex justify-between items-center gap-2 h-15">
        {isLoading && <Skeleton className="w-full" height="40px" />}

        <input
          type={"text"}
          inputMode={"decimal"}
          pattern={"[0-9]*[,.]?[0-9]*"}
          {...reactHookFormRegisterProps}
          ref={allInputRefs}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={"off"}
          className={clsx(
            "bg-gray-50 max-w-[140px] md:max-w-[none] md:min-w-[calc(100%-210px)] text-3xl font-medium placeholder-black border-transparent focus:border-transparent focus:ring-0 dark:bg-black-900 dark:placeholder-white",
            disabled &&
              "text-black-200 pointer-events-none placeholder-black-200",
            {
              hidden: isLoading,
            }
          )}
        />

        {selected && (
          <SelectAssets selected={selected} handleSelect={handleSelect} />
        )}
      </div>

      {errors?.[fieldName] ? (
        <span className="absolute bottom-4 left-5 text-xs sm:text-sm font-medium text-red-400">
          {(errors[fieldName] as FieldError).message}
        </span>
      ) : null}
      {price && price !== "0" && errors && !errors[fieldName] ? (
        <span className="absolute flex flex-nowrap items-center gap-2 bottom-4 left-5 text-xs sm:text-sm font-medium text-secondary">
          ~${Number.parseFloat(price).toFixed(2)}
          {label && label}
        </span>
      ) : null}

      <BlockMultiBalances
        balance={balance || 0n}
        decimals={selected?.decimals ?? 0}
        withNativeSupport={withNativeSupport ?? false}
        handleIncludeNativeToSwap={
          handleIncludeNativeToSwap ? handleIncludeNativeToSwap : () => {}
        }
        nativeSupportChecked={nativeSupportChecked ?? false}
        handleClick={handleSetMaxValue}
        disabled={disabled}
      />
    </div>
  )
}

FieldComboInput.displayName = FieldComboInputRegistryName
