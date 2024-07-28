"use client"

import React from "react"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Tooltip } from "@radix-ui/themes"
import clsx from "clsx"

import {
  EvaluateResultEnum,
  EvaluateSwapEstimationResult,
} from "../../hooks/useEvaluateSwapEstimation"
import { smallBalanceToFormat } from "../../utils"

const BlockEvaluatePrice = ({
  priceEvaluation,
  priceResults,
}: EvaluateSwapEstimationResult) => {
  return (
    <span className="flex flex-nowrap gap-2 items-center text-sm font-medium text-secondary">
      {priceEvaluation && (
        <span
          className={clsx(
            "flex flex-nowrap items-center gap-1 p-1.5 py-0.5 rounded-full text-xs",
            priceEvaluation === EvaluateResultEnum.BEST &&
              "bg-green-800 text-black",
            priceEvaluation === EvaluateResultEnum.LOW && "bg-pink text-white"
          )}
        >
          {priceEvaluation}
          {priceResults?.length && (
            <Tooltip
              content={
                <span className="flex flex-col gap-1">
                  {priceResults.map((result, i) => (
                    <span key={i}>
                      Rate {smallBalanceToFormat(result.amountOut)} from{" "}
                      {result.solverId}
                    </span>
                  ))}
                </span>
              }
            >
              <InfoCircledIcon />
            </Tooltip>
          )}
        </span>
      )}
    </span>
  )
}

export default BlockEvaluatePrice
