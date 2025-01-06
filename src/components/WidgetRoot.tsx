import { type ReactNode, createContext, useState } from "react"
import { createPortal } from "react-dom"
import root from "react-shadow"
import style from "../styles/main.css"

export const WidgetContext = createContext<{
  portalContainer: null | HTMLElement
}>({
  portalContainer: null,
})

export interface WidgetRootProps {
  children: ReactNode
}

export function WidgetRoot(props: WidgetRootProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )

  return (
    <WidgetContext.Provider value={{ portalContainer }}>
      {/*@ts-expect-error react-shadow is not correctly typed, `root.div` is correct element*/}
      <root.div>
        <style type="text/css">{style}</style>

        {props.children}
      </root.div>

      {createPortal(
        // @ts-expect-error react-shadow is not correctly typed, `root.div` is correct element
        <root.div>
          <style type="text/css">{style}</style>
          <div ref={setPortalContainer} />
        </root.div>,
        globalThis?.document?.body
      )}
    </WidgetContext.Provider>
  )
}
