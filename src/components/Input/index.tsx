import { TextField } from "@radix-ui/themes"
import clsx from "clsx"
import { type ReactNode, type Ref, forwardRef } from "react"
import styles from "./styles.module.css"

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
        className={clsx(styles.inputTrigger, className, {
          [styles.inputTriggerFullWidth || ""]: fullWidth,
          [styles.inputTriggerDisabled || ""]: disabled,
        })}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        type={type}
        ref={ref}
      >
        <TextField.Slot className={styles.slot}>{slotLeft}</TextField.Slot>
        <TextField.Slot className={styles.slot}>{slotRight}</TextField.Slot>
      </TextField.Root>
    )
  }
)
