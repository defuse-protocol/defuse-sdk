import clsx from "clsx"
import { type InputHTMLAttributes, type Ref, forwardRef } from "react"

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  name: string
  value?: string
  fullWidth?: boolean
  disabled?: boolean
  onChange?: (value: string) => void
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      name,
      value = "",
      placeholder,
      disabled = false,
      onChange,
      className,
      type = "text",
      ...rest
    }: InputProps,
    ref: Ref<HTMLInputElement>
  ) => {
    return (
      <input
        {...rest}
        name={name}
        className={clsx(
          "bg-transparent w-full text-3xl font-medium placeholder-black border-transparent focus:border-transparent focus:ring-0 dark:bg-black-900 dark:placeholder-white px-0",
          disabled &&
            "text-black-200 pointer-events-none placeholder-black-200",
          className
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        type={type}
        ref={ref}
      />
    )
  }
)
