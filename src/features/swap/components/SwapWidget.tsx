"use client"

import React from "react"

import { SwapWidgetProps } from "../../../types"

const SwapWidget = (props: Partial<SwapWidgetProps>) => {
  console.log("props.theme", props.theme)

  return <div>Test SwapWidget component</div>
}

export default SwapWidget
