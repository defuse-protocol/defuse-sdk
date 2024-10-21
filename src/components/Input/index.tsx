import { CopyIcon, PlusIcon } from "@radix-ui/react-icons"
import { Button, IconButton, Text, TextField } from "@radix-ui/themes"
import clsx from "clsx"
import type { ReactNode } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import type { FieldValues, Path, UseFormRegister } from "react-hook-form"
import styles from "./styles.module.css"

type Props<T, TFieldValues extends FieldValues> = {
  name: string
  register?: UseFormRegister<TFieldValues>
  placeholder?: string
  icon?: ReactNode
  value: string
  fullWidth?: boolean
  disabled?: boolean
  handleCopy?: () => void
  handleMax?: () => void
  onChange?: (value: string) => void
}
export const Input = <T extends string, TFieldValues extends FieldValues>({
  name,
  register,
  value,
  icon,
  placeholder,
  fullWidth = false,
  disabled = false,
  handleCopy,
  handleMax,
  onChange,
}: Props<T, TFieldValues>) => {
  const registerProps = register ? register(name as Path<TFieldValues>) : {}
  const { onChange: formOnChange, ...rest } = registerProps as {
    onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
  }
  return (
    <CopyToClipboard onCopy={handleCopy} text={value}>
      <TextField.Root
        className={clsx(styles.inputTrigger, {
          [styles.inputTriggerFullWidth || ""]: fullWidth,
          [styles.inputTriggerDisabled || ""]: disabled,
        })}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        {...rest}
      >
        <TextField.Slot>{icon && icon}</TextField.Slot>
        {handleCopy && (
          <TextField.Slot pr="3">
            <Button
              size="2"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                handleCopy()
              }}
            >
              <Text>Copy</Text>
              <CopyIcon height="14" width="14" />
            </Button>
          </TextField.Slot>
        )}
        {handleMax && (
          <TextField.Slot pr="3">
            <IconButton
              size="2"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                handleMax()
              }}
            >
              <PlusIcon height="14" width="14" />
            </IconButton>
          </TextField.Slot>
        )}
      </TextField.Root>
    </CopyToClipboard>
  )
}
