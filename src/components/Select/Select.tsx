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
}

export const Select = <T extends string, TFieldValues extends FieldValues>({
  name,
  register,
  options,
  placeholder,
  label,
  fullWidth = false,
}: Props<T, TFieldValues>) => {
  const { onChange, ...rest } = register(name as Path<TFieldValues>)

  return (
    <RadixSelect.Root
      onValueChange={(value: string) => onChange({ target: { value } })}
      {...rest}
    >
      <RadixSelect.Trigger
        className={clsx(styles.selectTrigger, {
          [styles.selectTriggerFullWidth || ""]: fullWidth,
        })}
        aria-label={label ?? "Not specified"}
      >
        <Flex as="span" align="center" gap="2">
          {placeholder?.icon && <Flex as="span">{placeholder.icon}</Flex>}
          <RadixSelect.Value placeholder={placeholder?.label} />
          <RadixSelect.Icon className={styles.selectIcon}>
            <ChevronDownIcon />
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
          <RadixSelect.ScrollUpButton className={styles.selectScrollButton}>
            <ChevronUpIcon />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className={styles.selectViewport}>
            {Object.keys(options).map((key: string) => (
              <SelectItem key={key} value={key}>
                {options[key as keyof typeof options].label}
              </SelectItem>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className={styles.selectScrollButton}>
            <ChevronDownIcon />
          </RadixSelect.ScrollDownButton>
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
      <RadixSelect.ItemIndicator className={styles.selectItemIndicator}>
        <CheckIcon />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}
