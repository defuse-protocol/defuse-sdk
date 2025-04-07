import { Button } from "@radix-ui/themes"
import type { RenderHostAppLink } from "../types/hostAppLink"
import { cn } from "../utils/cn"

export function AuthGate({
  renderHostAppLink,
  shouldRender,
  className,
  children,
}: {
  renderHostAppLink: RenderHostAppLink
  shouldRender: boolean
  children: React.ReactNode
  className?: string
}) {
  return shouldRender
    ? children
    : renderHostAppLink(
        "sign-in",
        <Button asChild size="4" className={cn("w-full h-14", className)}>
          <div>Sign in</div>
        </Button>,
        { className: "w-full" }
      )
}
