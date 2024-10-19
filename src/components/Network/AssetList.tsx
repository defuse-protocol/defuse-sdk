import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import React, { type ReactNode } from "react"

import type { BaseTokenInfo } from "../../types/base"
import { balanceToCurrency, balanceToDecimal } from "../../utils/balanceTo"
import { AssetComboIcon } from "../Asset/AssetComboIcon"
import type { SelectableToken } from "../Modal/ModalSelectAssets"

type Props = {
  title?: string
  assets: SelectableToken[]
  emptyState?: ReactNode
  className?: string
  handleSelectToken?: (token: BaseTokenInfo) => void
}

const EmptyAssetList = ({ className }: Pick<Props, "className">) => {
  return (
    <div
      className={clsx(
        "flex-1 w-full flex flex-col justify-center items-center text-center -mt-10",
        className && className
      )}
    >
      <div className="flex justify-center items-center rounded-full bg-gray-950 p-6 mb-4">
        <img src="/static/icons/cross-1.svg" alt="Close" className="w-8 h-8" />
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

const AssetList = ({
  title,
  assets,
  emptyState,
  className,
  handleSelectToken,
}: Props) => {
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
      {assets.map(
        (
          {
            name,
            chainName,
            symbol,
            balance,
            balanceUsd,
            disabled,
            decimals,
            ...rest
          },
          i
        ) => (
          <button
            key={rest.defuseAssetId}
            type={"button"}
            className={clsx(
              "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-950 dark:hover:bg-black-950",
              disabled && "opacity-50 pointer-events-none"
            )}
            onClick={() =>
              handleSelectToken &&
              assets[i] &&
              handleSelectToken(assets[i] as BaseTokenInfo)
            }
          >
            <AssetComboIcon
              name={name as string}
              chainName={chainName as string}
              {...rest}
            />
            <div className="grow flex flex-col">
              <div className="flex justify-between items-center">
                <Text as="span" size="2" weight="medium">
                  {name}
                </Text>
                <Text as="span" size="2" weight="medium">
                  {balance
                    ? Number(balanceToDecimal(balance, decimals)) < 0.00001
                      ? "< 0.00001"
                      : Number(balanceToDecimal(balance, decimals)).toFixed(7)
                    : null}
                </Text>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-500">
                <Text as="span" size="2">
                  {symbol ? symbol : null}
                </Text>
                <Text as="span" size="2">
                  {balanceUsd
                    ? `$${balanceToCurrency(Number(balanceUsd))}`
                    : null}
                </Text>
              </div>
            </div>
          </button>
        )
      )}
    </div>
  )
}

export default AssetList
