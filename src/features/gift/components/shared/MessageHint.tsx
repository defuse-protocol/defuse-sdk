import { Callout } from "@radix-ui/themes"
import { cn } from "src/utils/cn"

export function MessageHint({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <Callout.Root
      className={cn("bg-warning px-3 py-2 text-warning-foreground", className)}
    >
      <Callout.Text className="text-xs">
        <span>{text}</span>
      </Callout.Text>
    </Callout.Root>
  )
}
