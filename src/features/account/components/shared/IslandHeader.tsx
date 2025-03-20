import type { ReactNode } from "react"

export function IslandHeader({
  heading,
  rightSlot,
}: { heading: ReactNode; rightSlot: ReactNode }) {
  return (
    <div className="flex items-center px-5 -mt-5 -mx-5 h-[68px] border-b border-border">
      <div className="flex-1 text-2xl font-black">{heading}</div>

      {rightSlot}
    </div>
  )
}
