import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons"
import * as RadixSelect from "@radix-ui/react-select"
import { Flex, Theme } from "@radix-ui/themes"
import clsx from "clsx"
import type React from "react"
import { forwardRef } from "react"
import type { FieldValues, Path, UseFormRegister } from "react-hook-form"
import styles from "./styles.module.css"

type Props<T extends string, TFieldValues extends FieldValues> = {
  name: string
  register?: UseFormRegister<TFieldValues>
  options: {
    [key in T extends string ? T : never]: {
      label: string
      icon: React.ReactNode
      value: string
    }
  }
  placeholder: { label: string; icon: React.ReactNode }
  label?: string
  fullWidth?: boolean
  disabled?: boolean
  value?: string
  onChange?: (value: string) => void
  innerRef?: React.Ref<HTMLSelectElement>
}

export const Select = forwardRef(function Select<
  T extends string,
  TFieldValues extends FieldValues,
>(
  {
    name,
    register,
    options,
    placeholder,
    label,
    fullWidth = false,
    disabled = false,
    value,
    onChange,
  }: Props<T, TFieldValues>,
  ref: React.Ref<HTMLSelectElement>
) {
  const registerProps = register ? register(name as Path<TFieldValues>) : {}

  return (
    <RadixSelect.Root
      onValueChange={onChange}
      value={value}
      name={name}
      disabled={disabled}
      {...registerProps}
    >
      <RadixSelect.Trigger
        className={clsx(styles.selectTrigger, {
          [styles.selectTriggerFullWidth || ""]: fullWidth,
        })}
        aria-label={label ?? "Not specified"}
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
        <Theme>
          <RadixSelect.Content
            className={styles.selectContent}
            position="popper"
            side="bottom"
            sideOffset={8}
          >
            <RadixSelect.Viewport className={styles.selectViewport}>
              {Object.keys(options).map((key: string) => (
                <SelectItem
                  key={key}
                  value={options[key as keyof typeof options].value}
                >
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
        </Theme>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
})

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
