import type { ReactElement, ReactNode } from "react"

export type HostAppRoute = "withdraw" | "deposit" | "gift" | "sign-in"

export type RenderHostAppLink = (
  routeName: HostAppRoute,
  children: ReactNode,
  props: { className?: string }
) => ReactElement
