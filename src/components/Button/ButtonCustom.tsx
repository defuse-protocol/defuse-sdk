import {
  Button,
  type ButtonProps,
  Flex,
  Spinner,
  Text,
  Theme,
} from "@radix-ui/themes"
import React, { type ReactNode, type ButtonHTMLAttributes } from "react"
import styles from "./ButtonCustom.module.css"

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
  let buttonColorStyle: ButtonProps["color"]
  switch (variant) {
    case "primary":
      radixButtonVariant = "classic"
      break
    case "secondary":
      radixButtonVariant = "outline"
      buttonColorStyle = "gray"
      break
    case "base":
      radixButtonVariant = "solid"
      buttonColorStyle = "gray"
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
    <Theme accentColor={buttonColorStyle} asChild>
      <Flex align={"center"} gap={"2"} asChild>
        <Button
          variant={radixButtonVariant}
          size={radixButtonSize}
          disabled={disabled || isLoading}
          className={styles[size]}
          {...rest}
        >
          <Spinner loading={isLoading as boolean} />
          <Text weight={"bold"}>{children}</Text>
        </Button>
      </Flex>
    </Theme>
  )
}
