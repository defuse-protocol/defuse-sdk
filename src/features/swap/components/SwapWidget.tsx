import React from "react"

import { SwapWidgetProvider } from "src/providers"

import { SwapWidgetProps } from "../../../types"

export const SwapWidget = (props: Partial<SwapWidgetProps>) => {
  return <SwapWidgetProvider>SwapWidget</SwapWidgetProvider>
}
