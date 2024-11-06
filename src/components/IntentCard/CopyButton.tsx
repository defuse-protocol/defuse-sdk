import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import { IconButton } from "@radix-ui/themes"
import { useState } from "react"

interface CopyButtonProps {
  text: string
  ariaLabel?: string
}

export function CopyButton({ text, ariaLabel }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <IconButton
      onClick={handleCopy}
      size={"1"}
      variant={"ghost"}
      color={"gray"}
      aria-label={ariaLabel}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </IconButton>
  )
}
