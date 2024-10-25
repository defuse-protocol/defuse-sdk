import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import React, { type ReactNode } from "react"

import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { balanceToCurrency, balanceToDecimal } from "../../utils/balanceTo"
import type { SelectItemToken } from "../Modal/ModalSelectAssets"

import { isBaseToken } from "../../utils"
import { AssetBalance } from "./AssetBalance"
import { AssetComboIcon } from "./AssetComboIcon"

type Props<T> = {
  title?: string
  assets: SelectItemToken<T>[]
  emptyState?: ReactNode
  className?: string
  handleSelectToken?: (token: SelectItemToken<T>) => void
}

const EmptyAssetList = ({ className }: Pick<Props<unknown>, "className">) => {
  return (
    <div
      className={clsx(
        "flex-1 w-full flex flex-col justify-center items-center text-center -mt-10",
        className && className
      )}
    >
      <div className="flex justify-center items-center rounded-full bg-gray-950 p-6 mb-4">
        <img
          src="/static/icons/cross-1.svg"
          alt="Close"
          width={32}
          height={32}
        />
      </div>
      <Text size="4" weight="bold">
        Your token not found
      </Text>
      <Text size="2" weight="medium" className="text-gray-600">
        Try depositing to your wallet.
      </Text>
    </div>
  )
}

type Token = BaseTokenInfo | UnifiedTokenInfo

export const AssetList = <T extends Token>({
  title,
  assets,
  emptyState,
  className,
  handleSelectToken,
}: Props<T>) => {
  if (!assets.length) {
    return emptyState || <EmptyAssetList className={className ?? ""} />
  }
  return (
    <div className={clsx("flex flex-col", className && className)}>
      <div className="sticky top-0 z-10 px-5 h-[46px] flex items-center bg-white dark:bg-black-800 dark:text-white">
        <Text
          as="p"
          size="1"
          weight="medium"
          className="pt-2.5 text-gray-600 dark:text-gray-500"
        >
          {title}
        </Text>
      </div>
      {assets.map(({ itemId, token, disabled, balance }, i) => (
        <button
          key={itemId}
          type={"button"}
          className={clsx(
            "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-950 dark:hover:bg-black-950",
            disabled && "opacity-50 pointer-events-none"
          )}
          // biome-ignore lint/style/noNonNullAssertion: i is always within bounds
          onClick={() => handleSelectToken?.(assets[i]!)}
        >
          <AssetComboIcon
            icon={token.icon}
            name={token.name}
            chainIcon={isBaseToken(token) ? token.chainIcon : undefined}
            chainName={isBaseToken(token) ? token.chainName : undefined}
          />
          <div className="grow flex flex-col">
            <div className="flex justify-between items-center">
              <Text as="span" size="2" weight="medium">
                {token.name}
              </Text>
              <Text as="span" size="2" weight="medium">
                <AssetBalance asset={token} />
              </Text>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-500">
              <Text as="span" size="2">
                {token.symbol}
              </Text>
              <Text as="span" size="2">
                {balance
                  ? `$${balanceToCurrency(Number(balance.balanceUsd))}`
                  : null}
              </Text>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
