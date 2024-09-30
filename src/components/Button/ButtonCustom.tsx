import React, { ReactNode, ButtonHTMLAttributes } from "react"
import { FieldValues } from "react-hook-form"
import clsx from "clsx"
import { Button, Text, ButtonProps, TextProps, Spinner } from "@radix-ui/themes"

interface Props<T extends FieldValues>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  children?: ReactNode
  variant?: "primary" | "secondary" | "base" | "soft" | "solid"
  size?: "sm" | "base" | "lg"
  fullWidth?: boolean
  isLoading?: boolean
}

export const ButtonCustom = <T extends FieldValues>({
  children,
  variant = "primary",
  size = "base",
  fullWidth,
  disabled,
  isLoading = false,
  ...rest
}: Props<T>) => {
  const buttonBaseStyle = "cursor-pointer whitespace-nowrap"

  let buttonVariantStyle: ButtonProps["variant"]
  let buttonColorStyle: ButtonProps["color"]
  switch (variant) {
    case "primary":
      buttonVariantStyle = "classic"
      buttonColorStyle = "orange"
      break
    case "secondary":
      buttonVariantStyle = "outline"
      buttonColorStyle = "gray"
      break
    case "base":
      buttonVariantStyle = "solid"
      buttonColorStyle = "gray"
      break
  }

  let buttonSizeStyle: string
  let buttonTextSizeStyle: TextProps["size"]
  switch (size) {
    case "sm":
      buttonSizeStyle = ""
      buttonTextSizeStyle = "1"
      break
    case "base":
      buttonSizeStyle = "bg-gray-950"
      buttonTextSizeStyle = "2"
      break
    case "lg":
      buttonSizeStyle = "h-[56px] rounded-[0.5rem]"
      buttonTextSizeStyle = "6"
      break
  }

  const buttonStyle = clsx(
    buttonBaseStyle,
    buttonSizeStyle,
    (disabled || isLoading) && "pointer-events-none",
    fullWidth && "w-full block"
  )

  return (
    <Button
      variant={buttonVariantStyle}
      className={buttonStyle}
      color={buttonColorStyle}
      disabled={disabled || isLoading}
      {...rest}
    >
      <div className="flex justify-center items-center gap-2">
        <Spinner loading={isLoading as boolean} />
        <Text size={buttonTextSizeStyle}>{children}</Text>
      </div>
    </Button>
  )
}
