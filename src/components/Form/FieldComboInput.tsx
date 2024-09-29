import React from "react"
import {
  Path,
  FieldValues,
  FieldErrors,
  FieldError,
  UseFormRegister,
} from "react-hook-form"
import clsx from "clsx"

import { BaseTokenInfo } from "../../types/base"
import AssetsSelect from "../Network/SelectAssets"
import BlockMultiBalances, {
  BlockMultiBalancesProps,
} from "../Block/BlockMultiBalances"

interface Props<T extends FieldValues> {
  fieldName: Path<T>
  register?: UseFormRegister<T>
  required?: string
  placeholder?: string
  label?: string | React.ReactNode
  price?: string
  balance?: string | bigint
  selected?: BaseTokenInfo
  handleSelect?: () => void
  handleSetMaxValue?: () => void
  className?: string
  errors?: FieldErrors
  errorSelect?: string
  disabled?: boolean
}

export const FieldComboInputRegistryName = "FieldComboInput"

const FieldComboInput = <T extends FieldValues>({
  fieldName,
  register,
  required,
  placeholder = "0",
  label,
  price,
  balance,
  selected,
  handleSelect,
  handleSetMaxValue,
  className,
  errors,
  withNativeSupport,
  handleIncludeNativeToSwap,
  nativeSupportChecked,
  errorSelect,
  disabled,
}: Props<T> & BlockMultiBalancesProps) => {
  if (!register) {
    return null
  }

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

  const option = {
    pattern: {
      value: /^(?!0(\.0+)?$)(\d+(\.\d+)?|\.\d+)$/, // Valid result "100", "1.000", "0.000123", etc.
      message: "Please enter a valid number",
    },
  }
  if (required) {
    Object.assign(option, { required: "This field is required" })
  }

  return (
    <div
      className={clsx(
        "relative flex justify-between items-center px-5 py-[2.375rem] w-full bg-gray-50 dark:bg-black-900 dark:border-black-950",
        !label && "pt-5",
        !price && !balance && errors && !errors[fieldName] && "pb-5",
        className && className
      )}
    >
      <input
        {...register(fieldName, option)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(
          "grow flex-1 bg-gray-50 max-w-[140px] md:max-w-[none] md:min-w-[calc(100%-210px)] text-3xl font-medium placeholder-black border-transparent focus:border-transparent focus:ring-0 dark:bg-black-900 dark:placeholder-white",
          disabled && "text-black-200 pointer-events-none placeholder-black-200"
        )}
      />
      {errors && errors[fieldName] ? (
        <span className="absolute bottom-4 left-5 text-sm font-medium text-red-400">
          {(errors[fieldName] as FieldError).message}
        </span>
      ) : null}
      {price && price !== "0" && errors && !errors[fieldName] ? (
        <span className="absolute flex flex-nowrap items-center gap-2 bottom-4 left-5 text-sm font-medium text-secondary">
          ~${parseFloat(price).toFixed(2)}
          {label && label}
        </span>
      ) : null}
      <div className="flex justify-end items-center">
        <AssetsSelect selected={selected} handleSelect={handleSelect} />
      </div>
      {Number(balance) > 0 && !errorSelect && (
        <BlockMultiBalances
          balance={balance}
          withNativeSupport={withNativeSupport ?? false}
          handleIncludeNativeToSwap={
            handleIncludeNativeToSwap ? handleIncludeNativeToSwap : () => {}
          }
          nativeSupportChecked={nativeSupportChecked ?? false}
          handleClick={handleSetMaxValue || (() => {})}
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

export default FieldComboInput
