import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons"
import * as RadixSelect from "@radix-ui/react-select"
import { Flex } from "@radix-ui/themes"
import clsx from "clsx"
import type React from "react"
import type { FieldValues, Path, UseFormRegister } from "react-hook-form"
import styles from "./styles.module.css"

type Props<T, TFieldValues extends FieldValues> = {
  name: string
  register: UseFormRegister<TFieldValues>
  options: {
    [key in T extends string ? T : never]: {
      label: string
      icon: React.ReactNode
    }
  }
  placeholder: { label: string; icon: React.ReactNode }
  label?: string
  fullWidth?: boolean
  disabled?: boolean
}

export const Select = <T extends string, TFieldValues extends FieldValues>({
  name,
  register,
  options,
  placeholder,
  label,
  fullWidth = false,
  disabled = false,
}: Props<T, TFieldValues>) => {
  const { onChange, ...rest } = register(name as Path<TFieldValues>)

  return (
    <RadixSelect.Root
      onValueChange={(value: string) => {
        // Create a synthetic event object
        const event = {
          target: {
            name,
            value,
          },
        }
        onChange(event)
      }}
      {...rest}
    >
      <RadixSelect.Trigger
        className={clsx(styles.selectTrigger, {
          [styles.selectTriggerFullWidth || ""]: fullWidth,
        })}
        aria-label={label ?? "custom-select"}
        disabled={disabled}
      >
        <Flex as="span" align="center" justify="between" gap="2" width="100%">
          <Flex as="span" align="center" gap="2">
            {placeholder?.icon && (
              <Flex as="span" className={styles.selectPlaceholderIcon}>
                {placeholder.icon}
              </Flex>
            )}
            <RadixSelect.Value placeholder={placeholder?.label} />
          </Flex>
          <RadixSelect.Icon className={styles.selectDownIcon}>
            <ChevronDownIcon />
          </RadixSelect.Icon>
          <RadixSelect.Icon className={styles.selectUpIcon}>
            <ChevronUpIcon />
          </RadixSelect.Icon>
        </Flex>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className={styles.selectContent}
          position="popper"
          side="bottom"
          sideOffset={8}
        >
          <RadixSelect.Viewport className={styles.selectViewport}>
            {Object.keys(options).map((key: string) => (
              <SelectItem key={key} value={key}>
                <Flex
                  as="span"
                  align="center"
                  justify="between"
                  gap="2"
                  width="100%"
                >
                  {options[key as keyof typeof options]?.icon && (
                    <Flex as="span" className={styles.selectItemIcon}>
                      {options[key as keyof typeof options].icon}
                    </Flex>
                  )}
                  <Flex as="span">
                    {options[key as keyof typeof options].label}
                  </Flex>
                </Flex>
              </SelectItem>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => {
  return (
    <RadixSelect.Item className={styles.selectItem} value={value}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  )
}
