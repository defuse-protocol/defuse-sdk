import { Button } from "@radix-ui/themes"
import type { ReactNode } from "react"
import type {
  HostAppRoute,
  RenderHostAppLink,
} from "../../../../types/hostAppLink"
import { cn } from "../../../../utils/cn"

type NavButtonProps = {
  variant: "primary" | "secondary"
  label: string
  icon: ReactNode
  routeName: HostAppRoute
  renderHostAppLink: RenderHostAppLink
  className?: string
}

export function NavButton({
  variant,
  label,
  icon,
  routeName,
  renderHostAppLink,
  className,
}: NavButtonProps) {
  const children = (
    <>
      <Button
        variant={variant === "primary" ? "solid" : "soft"}
        color={variant === "primary" ? undefined : "gray"}
        size="4"
        className="w-full"
        asChild
      >
        <div>{icon}</div>
      </Button>

      <div className="text-gray-12 text-sm font-bold">{label}</div>
    </>
  )

  return renderHostAppLink(routeName, children, {
    className: cn("flex flex-col items-center gap-2 cursor-auto", className),
  })
}
