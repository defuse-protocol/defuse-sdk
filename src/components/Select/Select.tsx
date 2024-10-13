"use client"

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons"
import * as RadixSelect from "@radix-ui/react-select"
import clsx from "clsx"
import type React from "react"
import "./styles.css"
import { Flex } from "@radix-ui/themes"

type Props<T> = {
  value: string
  options: {
    [key in T extends string ? T : never]: {
      label: string
      icon: React.ReactNode
    }
  }
  placeholder: { label: string; icon: React.ReactNode }
  label?: string
  onChange: (value: string) => void
  fullWidth?: boolean
}

export const Select = <T extends string>({
  value,
  options,
  placeholder,
  onChange,
  label,
  fullWidth = false,
}: Props<T>) => {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger
        className={clsx("SelectTrigger", {
          "SelectTrigger--fullWidth": fullWidth,
        })}
        aria-label={label ?? "Not specified"}
      >
        <Flex as="span" align="center" gap="2">
          {placeholder?.icon && <Flex as="span">{placeholder.icon}</Flex>}
          <RadixSelect.Value placeholder={placeholder?.label} />
          <RadixSelect.Icon className="SelectIcon">
            {value ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </RadixSelect.Icon>
        </Flex>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className="SelectContent"
          position="popper"
          side="bottom"
          sideOffset={8}
        >
          <RadixSelect.ScrollUpButton className="SelectScrollButton">
            <ChevronUpIcon />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="SelectViewport">
            {Object.keys(options).map((key: string) => (
              <SelectItem key={key} value={key}>
                {options[key as keyof typeof options].label}
              </SelectItem>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="SelectScrollButton">
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
    <RadixSelect.Item className={clsx("SelectItem")} value={value}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="SelectItemIndicator">
        <CheckIcon />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}
