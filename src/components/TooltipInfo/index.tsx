import type { ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "../Popover"

export const TooltipInfo = ({
  children,
  icon,
}: { children: ReactNode; icon: ReactNode }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>{icon}</PopoverTrigger>
      <PopoverContent>
        <div className="text-sm">{children}</div>
      </PopoverContent>
    </Popover>
  )
}
