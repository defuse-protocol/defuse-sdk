import { Text } from "@radix-ui/themes"
import React, { useState, useDeferredValue, useEffect } from "react"
import type { BalanceMapping } from "../../features/machines/depositedBalanceMachine"
import { useModalStore } from "../../providers/ModalStoreProvider"
import { useTokensStore } from "../../providers/TokensStoreProvider"
import { ModalType } from "../../stores/modalStore"
import type {
  BaseTokenBalance,
  BaseTokenInfo,
  UnifiedTokenInfo,
} from "../../types/base"
import { isBaseToken } from "../../utils"
import { AssetList } from "../Asset/AssetList"
import { SearchBar } from "../SearchBar"
import { ModalDialog } from "./ModalDialog"

type Token = BaseTokenInfo | UnifiedTokenInfo

export type ModalSelectAssetsPayload = {
  modalType?: ModalType.MODAL_SELECT_ASSETS
  token?: Token
  fieldName?: string
  balances?: BalanceMapping
}

export type SelectItemToken<T = Token> = {
  itemId: string
  token: T
  disabled: boolean
  balance?: BaseTokenBalance
}

export const ModalSelectAssets = () => {
  const [searchValue, setSearchValue] = useState("")
  const [assetList, setAssetList] = useState<SelectItemToken[]>([])
  const [assetListWithBalances, setAssetListWithBalances] = useState<
    SelectItemToken[]
  >([])

  const { onCloseModal, modalType, payload } = useModalStore((state) => state)
  const { data, isLoading } = useTokensStore((state) => state)
  const deferredQuery = useDeferredValue(searchValue)

  const handleSearchClear = () => setSearchValue("")

  const filterPattern = (asset: SelectItemToken) =>
    asset.token.name
      .toLocaleUpperCase()
      .includes(deferredQuery.toLocaleUpperCase()) ||
    (isBaseToken(asset.token)
      ? asset.token.chainName
          .toLocaleUpperCase()
          .includes(deferredQuery.toLocaleUpperCase())
      : true)

  const handleSelectToken = (selectedItem: SelectItemToken) => {
    if (modalType !== ModalType.MODAL_SELECT_ASSETS) {
      throw new Error("Invalid modal type")
    }

    const newPayload: ModalSelectAssetsPayload = {
      ...(payload as ModalSelectAssetsPayload),
      modalType: ModalType.MODAL_SELECT_ASSETS,
      token: selectedItem.token,
    }
    onCloseModal(newPayload)
  }

  useEffect(() => {
    if (!data.size && !isLoading) {
      return
    }
    const { selectToken, fieldName } = payload as {
      selectToken: Token | undefined
      fieldName: string
      balances?: BalanceMapping
    }

    // Warning: This is unsafe type casting, payload could be anything
    const balances = (payload as ModalSelectAssetsPayload).balances ?? {}

    const selectedTokenId = selectToken
      ? isBaseToken(selectToken)
        ? selectToken.defuseAssetId
        : selectToken.unifiedAssetId
      : undefined

    const getAssetList: SelectItemToken[] = []
    const getAssetListWithBalances: SelectItemToken[] = []
    for (const [tokenId, token] of data) {
      // We do not filter "tokenIn" as give full access to tokens in first step
      // Filtration by routes should happen only at "tokenOut"
      const disabled = selectedTokenId != null && tokenId === selectedTokenId

      if (isBaseToken(token)) {
        const balance = balances[token.defuseAssetId]
        if (balance != null && balance > 0n) {
          getAssetListWithBalances.push({
            itemId: tokenId,
            token,
            disabled,
            balance: {
              balance: balance.toString(),
              balanceUsd: undefined,
              convertedLast: undefined,
            },
          })
        }
      } else {
        const totalBalance = token.groupedTokens.reduce<undefined | bigint>(
          (acc, innerToken) => {
            const balance = balances[innerToken.defuseAssetId]
            if (balance != null) {
              return (acc ?? 0n) + balance
            }
            return acc
          },
          undefined
        )

        if (totalBalance != null && totalBalance > 0n) {
          getAssetListWithBalances.push({
            itemId: tokenId,
            token,
            disabled,
            balance: {
              balance: totalBalance.toString(),
              balanceUsd: undefined,
              convertedLast: undefined,
            },
          })
        }
      }

      getAssetList.push({ itemId: tokenId, token, disabled })
    }
    setAssetList(getAssetList)
    setAssetListWithBalances(getAssetListWithBalances)
  }, [data, isLoading, payload])

  return (
    <ModalDialog>
      <div className="flex flex-col min-h-[680px] max-h-[680px] h-full">
        <div className="flex-none p-5 border-b border-gray-100 dark:border-black-950">
          <SearchBar
            query={searchValue}
            setQuery={setSearchValue}
            handleOverrideCancel={onCloseModal}
          />
        </div>
        {!deferredQuery.length && assetListWithBalances.length ? (
          <div className="relative flex-1 border-b border-gray-100 px-2.5 min-h-[228px] h-full max-h-[228px] overflow-y-auto dark:border-black-950">
            <AssetList
              assets={assetListWithBalances}
              title="Your tokens"
              handleSelectToken={handleSelectToken}
            />
          </div>
        ) : null}
        <div className="flex-1 flex flex-col justify-between border-b border-gray-100 px-2.5 overflow-y-auto dark:border-black-950">
          <AssetList
            assets={deferredQuery ? assetList.filter(filterPattern) : assetList}
            title={deferredQuery ? "Search results" : "Popular tokens"}
            className="h-full"
            handleSelectToken={handleSelectToken}
          />
          {deferredQuery && (
            <div className="flex justify-center items-center">
              <button
                type={"button"}
                onClick={handleSearchClear}
                className="mb-2.5 px-3 py-1.5 bg-red-100 rounded-full"
              >
                <Text size="2" weight="medium" className="text-red-400">
                  Clear results
                </Text>
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalDialog>
  )
}
