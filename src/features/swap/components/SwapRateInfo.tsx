import * as Accordion from "@radix-ui/react-accordion"
import { CaretDownIcon } from "@radix-ui/react-icons"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { useReducer } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/Popover"
import { useTokensUsdPrices } from "../../../hooks/useTokensUsdPrices"
import type { SwappableToken } from "../../../types/swap"
import { formatTokenValue, formatUsdAmount } from "../../../utils/format"
import getTokenUsdPrice from "../../../utils/getTokenUsdPrice"
import { useSwapRateData } from "../hooks/useSwapRateData"

interface SwapRateInfoProps {
  tokenIn: SwappableToken
  tokenOut: SwappableToken
}

export function SwapRateInfo({ tokenIn, tokenOut }: SwapRateInfoProps) {
  const {
    minAmountOut,
    slippageBasisPoints,
    tokenOutPerTokenIn,
    tokenInPerTokenOut,
  } = useSwapRateData()
  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const [showTokenInPrice, toggleShowTokenInPrice] = useToggle()

  // todo: might need to handle outside of the component
  const rateIsReady = tokenOutPerTokenIn != null || tokenInPerTokenOut != null
  if (!rateIsReady) {
    return null
  }

  return (
    <Accordion.Root type="single" collapsible className="mt-5">
      <Accordion.Item value="show">
        <div className="flex justify-between items-center flex-1 text-gray-11">
          <button
            type="button"
            onClick={toggleShowTokenInPrice}
            className="text-xs font-medium"
          >
            {showTokenInPrice ? (
              <div className="flex gap-1">
                {tokenOutPerTokenIn != null &&
                  `1 ${tokenIn.symbol} = ${formatTokenValue(
                    tokenOutPerTokenIn.amount,
                    tokenOutPerTokenIn.decimals,
                    { fractionDigits: 5 }
                  )} ${tokenOut.symbol}`}

                {tokenOutPerTokenIn != null &&
                  (() => {
                    const price = getTokenUsdPrice(
                      formatTokenValue(
                        tokenOutPerTokenIn.amount,
                        tokenOutPerTokenIn.decimals
                      ),
                      tokenOut,
                      tokensUsdPriceData
                    )
                    if (price != null) {
                      return (
                        <span className="text-gray-a9">
                          ({formatUsdAmount(price)})
                        </span>
                      )
                    }
                    return null
                  })()}
              </div>
            ) : (
              <div className="flex gap-1">
                {tokenInPerTokenOut != null &&
                  `1 ${tokenOut.symbol} = ${formatTokenValue(
                    tokenInPerTokenOut.amount,
                    tokenInPerTokenOut.decimals,
                    { fractionDigits: 5 }
                  )} ${tokenIn.symbol}`}

                {tokenInPerTokenOut != null &&
                  (() => {
                    const price = getTokenUsdPrice(
                      formatTokenValue(
                        tokenInPerTokenOut.amount,
                        tokenInPerTokenOut.decimals
                      ),
                      tokenIn,
                      tokensUsdPriceData
                    )
                    if (price != null) {
                      return (
                        <span className="text-gray-a9">
                          ({formatUsdAmount(price)})
                        </span>
                      )
                    }
                    return null
                  })()}
              </div>
            )}
          </button>

          <Accordion.Trigger className="transition-all [&[data-state=open]>svg]:rotate-180">
            <CaretDownIcon className="h-5 w-5 transition-transform duration-200" />
          </Accordion.Trigger>
        </div>

        <Accordion.Content className="overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          {/* Simple spacing for smooth toggle animation */}
          <div className="h-4" />

          <div className="flex flex-col gap-3.5 font-medium text-gray-11 text-xs">
            <div className="flex justify-between">
              <div className="flex gap-1 items-center">
                <div>Max slippage</div>

                <Popover>
                  <PopoverTrigger>
                    <InfoCircledIcon />
                  </PopoverTrigger>
                  <PopoverContent className="flex flex-col gap-2 text-sm">
                    <div className="text-gray-11">
                      If the price slips any further, your intent will not be
                      executed. Below is the minimum amount you are guaranteed
                      to receive.
                    </div>
                    {minAmountOut != null && (
                      <div className="flex justify-between p-2 rounded-md bg-gray-3 text-gray-11">
                        <div>Receive at least</div>

                        <div className="text-gray-12">
                          {formatTokenValue(
                            minAmountOut.amount,
                            minAmountOut.decimals,
                            { fractionDigits: 5 }
                            // biome-ignore lint/nursery/useConsistentCurlyBraces: space is intentional
                          )}{" "}
                          {tokenOut.symbol}
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="text-label">
                {Intl.NumberFormat(undefined, {
                  style: "percent",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(slippageBasisPoints / 10_000)}
              </div>
            </div>
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  )
}

function useToggle(defaultValue = false) {
  return useReducer((state) => !state, defaultValue)
}
