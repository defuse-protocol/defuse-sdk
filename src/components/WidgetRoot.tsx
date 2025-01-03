import type { ReactNode } from "react"
import root from "react-shadow"
import style from "../styles/main.css"

export interface WidgetRootProps {
  children: ReactNode
}

export function WidgetRoot(props: WidgetRootProps) {
  return (
    // @ts-expect-error react-shadow is not correctly typed, `root.div` is correct element
    <root.div>
      <style type="text/css">{style}</style>

      {props.children}
    </root.div>
  )
}
