import { TooltipProvider } from "@radix-ui/react-tooltip"
import * as Tooltip from "@radix-ui/react-tooltip"
import { Theme } from "@radix-ui/themes"
import { useContext } from "react"
import { WidgetContext } from "../WidgetRoot"

export const TooltipInfo = ({
  children,
  icon,
}: { children: React.ReactNode; icon: React.ReactNode }) => {
  const { portalContainer } = useContext(WidgetContext)

  return (
    <div className="hidden md:block">
      <TooltipProvider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{icon}</Tooltip.Trigger>
          <Tooltip.Portal container={portalContainer}>
            <Theme asChild>
              <Tooltip.Content className="TooltipContent" sideOffset={5}>
                <div className="text-xs min-w-[200px] bg-black text-white rounded px-2 py-0.5">
                  {children}
                </div>
              </Tooltip.Content>
            </Theme>
          </Tooltip.Portal>
        </Tooltip.Root>
      </TooltipProvider>
    </div>
  )
}
