import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import React, { useCallback, useEffect, type ReactNode } from "react"

import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { balanceToCurrency } from "../../utils/balanceTo"
import type { SelectItemToken } from "../Modal/ModalSelectAssets"

import { useGetNearBalances } from "src/hooks/useNearGetTokenBalance"
import { formatUnits } from "viem"
import { isBaseToken } from "../../utils"
import { AssetBalance } from "./AssetBalance"
import { AssetComboIcon } from "./AssetComboIcon"

type Props<T> = {
  title?: string
  assets: SelectItemToken<T>[]
  emptyState?: ReactNode
  className?: string
  accountId?: string
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
  accountId,
  handleSelectToken,
}: Props<T>) => {
  if (!assets.length) {
    return emptyState || <EmptyAssetList className={className ?? ""} />
  }

  const { data: balances, mutate: fetchBalances } = useGetNearBalances()

  useEffect(() => {
    if (accountId) {
      fetchBalances({
        tokenList: assets.map((item) => item.token),
        userAddress: accountId,
      })
    }
  }, [accountId, fetchBalances, assets])

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
      {assets.map(({ itemId, token, disabled, balance, defuseAssetId }, i) => (
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
                {balances && (
                  <AssetBalanceAdapter
                    balances={balances}
                    decimals={token.decimals}
                    defuseAssetId={defuseAssetId}
                  />
                )}
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

const AssetBalanceAdapter = ({
  balances,
  decimals,
  defuseAssetId,
}: {
  balances: Record<string, bigint>
  decimals: number
  defuseAssetId?: string
}) => {
  const calculateBalance = useCallback(() => {
    if (!balances || !defuseAssetId) {
      return "0"
    }
    const tokenIds = defuseAssetId.split(",")
    const isGroupedToken = tokenIds.length > 1
    if (isGroupedToken) {
      return tokenIds.reduce((acc, assetId) => {
        const balance = formatUnits(balances[assetId] ?? BigInt(0), decimals)
        return (Number(acc) + Number(balance)).toString()
      }, "0")
    }
    if (defuseAssetId === "nep141:wrap.near") {
      return formatUnits(
        (balances[defuseAssetId] ?? BigInt(0)) +
          (balances["near:native"] ?? BigInt(0)),
        decimals
      )
    }
    return formatUnits(balances[defuseAssetId] ?? BigInt(0), decimals)
  }, [balances, defuseAssetId, decimals])

  return <AssetBalance balance={calculateBalance()} />
}
