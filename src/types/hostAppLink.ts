import type { ReactElement, ReactNode } from "react"

export type HostAppRoute =
  | "withdraw"
  | "deposit"
  | "gift"
  | "sign-in"
  | "swap"
  | "otc"

export type RenderHostAppLink = (
  routeName: HostAppRoute,
  children: ReactNode,
  props: { className?: string }
) => ReactElement
