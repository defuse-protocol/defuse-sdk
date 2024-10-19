import { Text } from "@radix-ui/themes"
import React, { useState, useDeferredValue, useEffect } from "react"
import { useModalStore } from "../../providers/ModalStoreProvider"
import { useTokensStore } from "../../providers/TokensStoreProvider"
import type { ModalType } from "../../stores/modalStore"
import type { BaseTokenBalance, BaseTokenInfo } from "../../types/base"
import { AssetList } from "../Asset/AssetList"
import { SearchBar } from "../SearchBar"
import { ModalDialog } from "./ModalDialog"

type Token = BaseTokenInfo

export type ModalSelectAssetsPayload = {
  modalType?: ModalType.MODAL_SELECT_ASSETS
  token?: Token
  fieldName?: string
}

export type SelectableToken<T = Token> = {
  token: T
  disabled: boolean
  balance?: BaseTokenBalance
}

export const ModalSelectAssets = () => {
  const [searchValue, setSearchValue] = useState("")
  const [assetList, setAssetList] = useState<SelectableToken[]>([])
  const [assetListWithBalances, setAssetListWithBalances] = useState<
    SelectableToken[]
  >([])

  const { onCloseModal, modalType, payload } = useModalStore((state) => state)
  const { data, isLoading } = useTokensStore((state) => state)
  const deferredQuery = useDeferredValue(searchValue)

  const handleSearchClear = () => setSearchValue("")

  const filterPattern = (asset: SelectableToken) =>
    asset.token.name
      .toLocaleUpperCase()
      .includes(deferredQuery.toLocaleUpperCase()) ||
    ("chainName" in asset.token &&
      asset.token.chainName
        .toLocaleUpperCase()
        .includes(deferredQuery.toLocaleUpperCase()))

  const handleSelectToken = (token: SelectableToken) => {
    onCloseModal({
      ...(payload as { fieldName: string }),
      modalType,
      token,
    })
  }

  useEffect(() => {
    if (!data.size && !isLoading) {
      return
    }
    const { selectToken, fieldName } = payload as {
      selectToken: Token | undefined
      fieldName: string
    }

    const selectedTokenId = selectToken ? selectToken.defuseAssetId : undefined

    const getAssetList: SelectableToken[] = []
    const getAssetListWithBalances: SelectableToken[] = []
    for (const [tokenId, token] of data) {
      // We do not filter "tokenIn" as give full access to tokens in first step
      // Filtration by routes should happen only at "tokenOut"
      const disabled = selectedTokenId != null && tokenId === selectedTokenId

      if (
        token.balance != null &&
        token.balanceUsd != null &&
        token.convertedLast != null
      ) {
        getAssetListWithBalances.push({
          token: token,
          disabled,
          balance: {
            balance: token.balance,
            balanceUsd: token.balanceUsd,
            convertedLast: token.convertedLast,
          },
        })
      }

      getAssetList.push({ token: token, disabled })
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
