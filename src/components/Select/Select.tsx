import { ChevronDownIcon } from "@radix-ui/react-icons"
import * as RadixSelect from "@radix-ui/react-select"
import { Flex, Theme } from "@radix-ui/themes"
import type React from "react"
import { useContext } from "react"
import type { FieldValues, Path, UseFormRegister } from "react-hook-form"
import { WidgetContext } from "../WidgetRoot"

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

export const Select = function Select<
  T extends string,
  TFieldValues extends FieldValues,
>({
  name,
  register,
  options,
  placeholder,
  label,
  fullWidth = false,
  disabled = false,
  value,
  onChange,
}: Props<T, TFieldValues>) {
  const registerProps = register ? register(name as Path<TFieldValues>) : {}
  const showPlaceholder = value == null || value === ""
  const { portalContainer } = useContext(WidgetContext)
  return (
    <RadixSelect.Root
      onValueChange={onChange}
      value={value}
      name={name}
      disabled={disabled}
      {...registerProps}
    >
      <RadixSelect.Trigger
        className={`flex items-center justify-center text-base leading-6 h-14 px-4 gap-3 bg-gray-50 hover:bg-gray-200/50 text-gray-500 box-border flex-shrink-0 rounded-lg border border-gray-300 data-[placeholder]:text-[#63635e] ${
          fullWidth ? "w-full" : ""
        }`}
        aria-label={label ?? "Not specified"}
        disabled={disabled}
      >
        <Flex as="span" align="center" justify="between" gap="2" width="100%">
          <Flex as="span" align="center" gap="2">
            {showPlaceholder && placeholder?.icon && (
              <Flex as="span">{placeholder.icon}</Flex>
            )}
            <RadixSelect.Value placeholder={placeholder?.label} />
          </Flex>
          <RadixSelect.Icon>
            <ChevronDownIcon />
          </RadixSelect.Icon>
        </Flex>
      </RadixSelect.Trigger>
      <RadixSelect.Portal container={portalContainer}>
        <Theme asChild>
          <RadixSelect.Content
            className="overflow-hidden bg-white rounded-md shadow-md w-[var(--radix-select-trigger-width)] max-h-[var(--radix-select-content-available-height)] max-w-[var(--radix-select-trigger-width)] box-border"
            position="popper"
            side="bottom"
            sideOffset={8}
          >
            <RadixSelect.Viewport className="p-2 flex flex-col gap-1">
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
                      <Flex as="span" className="flex-shrink-0">
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
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => {
  return (
    <RadixSelect.Item
      className="flex p-2 items-center justify-between gap-3 self-stretch text-sm leading-none text-[#63635e] rounded-[3px] relative select-none w-full data-[highlighted]:outline-none data-[highlighted]:bg-[#f1f0ef] data-[highlighted]:rounded-lg data-[highlighted]:text-[#21201c] data-[state=checked]:bg-[#f1f0ef] data-[state=checked]:rounded-lg data-[state=checked]:text-[#21201c] data-[disabled]:text-mauve-8 data-[disabled]:pointer-events-none"
      value={value}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  )
}
