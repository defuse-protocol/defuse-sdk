import { TextField } from "@radix-ui/themes"
import clsx from "clsx"
import type { ReactNode } from "react"
import type { FieldValues } from "react-hook-form"
import styles from "./styles.module.css"

type Props<T, TFieldValues extends FieldValues> = {
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
export const Input = <T extends string, TFieldValues extends FieldValues>({
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
}: Props<T, TFieldValues>) => {
  return (
    <TextField.Root
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
    >
      <TextField.Slot className={styles.slot}>{slotLeft}</TextField.Slot>
      <TextField.Slot className={styles.slot}>{slotRight}</TextField.Slot>
    </TextField.Root>
  )
}
