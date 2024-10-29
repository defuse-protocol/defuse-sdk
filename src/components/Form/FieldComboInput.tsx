import clsx from "clsx"
import type React from "react"
import { useRef } from "react"
import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Path,
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
  required?: string
  placeholder?: string
  label?: string | React.ReactNode
  price?: string
  balance?: bigint
  selected?: BaseTokenInfo | UnifiedTokenInfo
  handleSelect?: () => void
  className?: string
  errors?: FieldErrors
  errorSelect?: string
  disabled?: boolean
}

export const FieldComboInputRegistryName = "FieldComboInput"

export const FieldComboInput = <T extends FieldValues>({
  fieldName,
  register,
  required,
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
  errorSelect,
  disabled,
}: Props<T>) => {
  if (!register) {
    return null
  }

  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      "Backspace",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "Delete", // control keys
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9", // numeric keys
      ".", // decimal point
    ]

    if (!allowedKeys.includes(event.key) && !event.ctrlKey) {
      event.preventDefault()
    }

    // Ensure only one dot is allowed
    const inputValue = (event.target as HTMLInputElement).value
    if (event.key === "." && inputValue.includes(".")) {
      event.preventDefault()
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = event.clipboardData.getData("text")

    if (!/^[0-9.,]+$/.test(paste)) {
      event.preventDefault()
    }
  }

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

  const option = {
    pattern: {
      value: /^(?!0(\.0+)?$)(\d+(\.\d+)?|\.\d+)$/, // Valid result "100", "1.000", "0.000123", etc.
      message: "Please enter a valid number",
    },
  }
  if (required) {
    Object.assign(option, { required: "This field is required" })
  }

  // react-hook-form specific props
  const reactHookFormRegisterProps = register(fieldName, option)

  const allInputRefs = useMergedRef(inputRef, reactHookFormRegisterProps.ref)

  return (
    <div
      className={clsx(
        "relative flex justify-between items-center px-5 py-[2.375rem] w-full bg-gray-50 dark:bg-black-900 dark:border-black-950",
        !label && "pt-5",
        !price && balance == null && errors && !errors[fieldName] && "pb-5",
        className && className
      )}
    >
      <input
        type={"text"}
        {...reactHookFormRegisterProps}
        ref={allInputRefs}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={"off"}
        className={clsx(
          "grow flex-1 bg-gray-50 max-w-[140px] md:max-w-[none] md:min-w-[calc(100%-210px)] text-3xl font-medium placeholder-black border-transparent focus:border-transparent focus:ring-0 dark:bg-black-900 dark:placeholder-white",
          disabled && "text-black-200 pointer-events-none placeholder-black-200"
        )}
      />
      {errors?.[fieldName] ? (
        <span className="absolute bottom-4 left-5 text-sm font-medium text-red-400">
          {(errors[fieldName] as FieldError).message}
        </span>
      ) : null}
      {price && price !== "0" && errors && !errors[fieldName] ? (
        <span className="absolute flex flex-nowrap items-center gap-2 bottom-4 left-5 text-sm font-medium text-secondary">
          ~${Number.parseFloat(price).toFixed(2)}
          {label && label}
        </span>
      ) : null}
      <div className="flex justify-end items-center">
        {selected && (
          <SelectAssets selected={selected} handleSelect={handleSelect} />
        )}
      </div>
      {balance != null && !errorSelect && (
        <BlockMultiBalances
          balance={balance}
          decimals={selected?.decimals ?? 0}
          withNativeSupport={withNativeSupport ?? false}
          handleIncludeNativeToSwap={
            handleIncludeNativeToSwap ? handleIncludeNativeToSwap : () => {}
          }
          nativeSupportChecked={nativeSupportChecked ?? false}
          handleClick={handleSetMaxValue}
        />
      )}
      {errorSelect && (
        <div className="absolute bottom-4 right-5 flex justify-center items-center gap-2">
          <span className="text-sm text-red-400">{errorSelect}</span>
        </div>
      )}
    </div>
  )
}

FieldComboInput.displayName = FieldComboInputRegistryName
