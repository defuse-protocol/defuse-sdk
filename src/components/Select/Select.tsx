import { ChevronDownIcon } from "@radix-ui/react-icons"
import * as RadixSelect from "@radix-ui/react-select"
import { Theme } from "@radix-ui/themes"
import type { ReactNode } from "react"
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
  disabled?: boolean
  value?: string
  hint?: ReactNode
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
  disabled,
  value,
  hint,
  onChange,
}: Props<T, TFieldValues>) {
  const registerProps = register ? register(name as Path<TFieldValues>) : {}
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
                  <div className="flex items-center justify-between w-full gap-2">
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
  children: React.ReactNode
}

const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => {
  return (
    <RadixSelect.Item
      className="flex p-2 items-center justify-between gap-3 self-stretch font-bold text-sm text-gray-12 rounded-[3px] relative select-none w-full data-[highlighted]:outline-none data-[highlighted]:bg-[#f1f0ef] data-[highlighted]:rounded-lg data-[state=checked]:bg-[#f1f0ef] data-[state=checked]:rounded-lg data-[disabled]:text-mauve-8 data-[disabled]:pointer-events-none"
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
