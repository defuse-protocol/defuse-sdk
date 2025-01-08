import { ReloadIcon } from "@radix-ui/react-icons"
import { Button, type ButtonProps, Flex, Text } from "@radix-ui/themes"
import type { ButtonHTMLAttributes, ReactNode } from "react"

interface ButtonCustomProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  children?: ReactNode
  variant?: "primary" | "secondary" | "base" | "soft" | "solid"
  size?: "sm" | "base" | "lg"
  fullWidth?: boolean
  isLoading?: boolean
}

export const ButtonCustom = ({
  children,
  variant = "primary",
  size = "base",
  fullWidth,
  disabled,
  isLoading = false,
  ...rest
}: ButtonCustomProps) => {
  let radixButtonVariant: ButtonProps["variant"]
  let radixButtonColor: ButtonProps["color"]
  switch (variant) {
    case "primary":
      radixButtonVariant = undefined
      break
    case "secondary":
      radixButtonVariant = "outline"
      radixButtonColor = "gray"
      break
    case "base":
      radixButtonVariant = "solid"
      radixButtonColor = "gray"
      break
  }

  let radixButtonSize: ButtonProps["size"] | undefined
  switch (size) {
    case "sm":
      radixButtonSize = "1"
      break
    case "base":
      break
    case "lg":
      radixButtonSize = "4"
      break
  }

  return (
    <Flex align="center" gap="2" asChild>
      <Button
        color={radixButtonColor}
        variant={radixButtonVariant}
        size={radixButtonSize}
        disabled={disabled || isLoading}
        className={
          {
            sm: "h-8",
            base: "h-10",
            lg: "h-14",
          }[size]
        }
        {...rest}
      >
        {isLoading ? <ReloadIcon className="size-5 animate-spin" /> : null}
        <Text weight="bold">{children}</Text>
      </Button>
    </Flex>
  )
}
