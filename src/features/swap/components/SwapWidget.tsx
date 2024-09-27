"use client"

import React from "react"
import { useActor } from "@xstate/react"
import { createActor } from "xstate"

import { SwapMessageParams, SwapWidgetProps } from "src/types"
import RootStoreProvider from "src/providers/DefuseProvider"

import SwapForm from "./SwapForm"

const SwapWidget = ({ theme, tokenList, onSign, event }: SwapWidgetProps) => {
  // TODO Coonect to swapm machine package
  // const [state, send] = useActor(createActor(swapMachine))

  return (
    <RootStoreProvider>
      <SwapForm />
    </RootStoreProvider>
  )
}

export default SwapWidget
