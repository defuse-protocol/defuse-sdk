import { TextField } from "@radix-ui/themes"
import clsx from "clsx"
import { type ReactNode, type Ref, forwardRef } from "react"

interface InputProps extends Omit<TextField.RootProps, "onChange"> {
  name: string
  placeholder?: string
  value?: string
  fullWidth?: boolean
  disabled?: boolean
  onChange?: (value: string) => void
  className?: string
  slotLeft?: ReactNode | null
  slotRight?: ReactNode | null
  type?: "text" | "number"
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      name,
      value = "",
      placeholder,
      fullWidth = false,
      disabled = false,
      onChange,
      className,
      slotLeft = null,
      slotRight = null,
      type = "text",
      ...rest
    }: InputProps,
    ref: Ref<HTMLInputElement>
  ) => {
    return (
      <TextField.Root
        {...rest}
        name={name}
        className={clsx(
          "relative flex justify-between items-center px-5 py-[2.375rem] w-full text-lg font-base leading-6 text-black max-w-full box-border flex-shrink-0 rounded-lg bg-gray-100/60 bg-clip-border bg-none border border-gray-200/50",
          "shadow-none outline-none",
          "dark:bg-gray-900 dark:border-gray-950",
          "[&>input]:flex-1 [&>input]:text-3xl [&>input]:font-medium [&>input]:bg-transparent [&>input]:border-0 [&>input:focus]:outline-none [&>input:focus]:ring-0",
          {
            "w-full": fullWidth,
            "text-gray-200": disabled,
          },
          className
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        type={type}
        ref={ref}
      >
        <TextField.Slot className="p-0">{slotLeft}</TextField.Slot>
        <TextField.Slot className="p-0">{slotRight}</TextField.Slot>
      </TextField.Root>
    )
  }
)
