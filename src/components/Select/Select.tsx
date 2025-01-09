import { ChevronDownIcon } from "@radix-ui/react-icons"
import * as RadixSelect from "@radix-ui/react-select"
import { Theme } from "@radix-ui/themes"
import type { ReactNode } from "react"
import { useContext } from "react"
import { WidgetContext } from "../WidgetRoot"

type Props<T extends string> = {
  name: string
  options: {
    [key in T extends string ? T : never]: {
      label: string
      icon: ReactNode
      value: string
    }
  }
  placeholder: { label: string; icon: ReactNode }
  label?: string
  disabled?: boolean
  value?: string
  hint?: ReactNode
  onChange?: (value: string) => void
}

export function Select<T extends string>({
  name,
  options,
  placeholder,
  label,
  disabled,
  value,
  hint,
  onChange,
}: Props<T>) {
  const { portalContainer } = useContext(WidgetContext)
  return (
    <RadixSelect.Root
      onValueChange={onChange}
      value={value}
      name={name}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        className="h-12 gap-3 rounded-lg bg-gray-3 px-4 text-gray-12 leading-6 ring-accent-9 ring-inset transition-all duration-100 ease-in-out hover:bg-gray-4 data-[state=open]:bg-gray-4 data-[state=open]:ring-2"
        aria-label={label ?? "Not specified"}
        disabled={disabled}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="hidden items-center gap-2 [[data-placeholder]_&]:flex">
            {placeholder?.icon && <div>{placeholder.icon}</div>}
            <div className="font-medium text-gray-11 text-sm">
              {placeholder?.label}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-between [[data-placeholder]_&]:hidden">
            <div className="font-bold text-sm">
              <RadixSelect.Value />
            </div>
            {hint != null ? hint : null}
          </div>

          {Object.keys(options).length > 1 ? (
            <RadixSelect.Icon>
              <ChevronDownIcon className="size-7" />
            </RadixSelect.Icon>
          ) : null}
        </div>
      </RadixSelect.Trigger>

      <RadixSelect.Portal container={portalContainer}>
        <Theme asChild>
          <RadixSelect.Content
            className="box-border max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md bg-white shadow-md"
            position="popper"
            side="bottom"
            sideOffset={8}
          >
            <RadixSelect.Viewport className="flex flex-col gap-1 p-2">
              {Object.keys(options).map((key: string) => (
                <SelectItem
                  key={key}
                  value={options[key as keyof typeof options].value}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    {options[key as keyof typeof options]?.icon && (
                      <div className="flex-shrink-0">
                        {options[key as keyof typeof options].icon}
                      </div>
                    )}
                    <div>{options[key as keyof typeof options].label}</div>
                  </div>
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
  children: ReactNode
}

function SelectItem({ value, children }: SelectItemProps) {
  return (
    <RadixSelect.Item
      className="relative flex w-full select-none items-center justify-between gap-3 self-stretch rounded-[3px] p-2 font-bold text-gray-12 text-sm data-[disabled]:pointer-events-none data-[highlighted]:rounded-lg data-[state=checked]:rounded-lg data-[highlighted]:bg-[#f1f0ef] data-[state=checked]:bg-[#f1f0ef] data-[disabled]:text-mauve-8 data-[highlighted]:outline-none"
      value={value}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  )
}

Select.Hint = function Badge({ children }: { children: ReactNode }) {
  return (
    <div className="rounded bg-gray-a3 px-2 py-1 font-medium text-gray-a11 text-xs">
      {children}
    </div>
  )
}
