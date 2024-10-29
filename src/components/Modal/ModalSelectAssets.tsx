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
import { isBaseToken, isUnifiedToken } from "../../utils"
import { AssetList } from "../Asset/AssetList"
import { EmptyAssetList } from "../Asset/EmptyAssetList"
import { SearchBar } from "../SearchBar"
import { ModalDialog } from "./ModalDialog"

type Token = BaseTokenInfo | UnifiedTokenInfo

export type ModalSelectAssetsPayload = {
  modalType?: ModalType.MODAL_SELECT_ASSETS
  token?: Token
  fieldName?: string
  balances?: BalanceMapping
  accountId?: string
}

export type SelectItemToken<T = Token> = {
  itemId: string
  token: T
  disabled: boolean
  defuseAssetId?: string
  balance?: BaseTokenBalance
}

export const ModalSelectAssets = () => {
  const [searchValue, setSearchValue] = useState("")
  const [assetList, setAssetList] = useState<SelectItemToken[]>([])

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

    for (const [tokenId, token] of data) {
      const disabled = selectedTokenId != null && tokenId === selectedTokenId
      if (isUnifiedToken(token)) {
        // We join defuseAssetId of all grouped tokens to get a single string
        // to simplify search balances and not mutate token object
        const defuseAssetId = token.groupedTokens.reduce(
          (acc, innerToken) =>
            innerToken.defuseAssetId != null
              ? [acc, innerToken.defuseAssetId].join(",")
              : acc,
          ""
        )

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

        getAssetList.push({
          itemId: tokenId,
          token,
          disabled,
          defuseAssetId,
          balance:
            totalBalance == null
              ? undefined
              : {
                  balance: totalBalance.toString(),
                  balanceUsd: undefined,
                  convertedLast: undefined,
                },
        })
      } else if (isBaseToken(token)) {
        const balance = balances[token.defuseAssetId]
        getAssetList.push({
          itemId: tokenId,
          token,
          disabled,
          balance:
            balance == null
              ? undefined
              : {
                  balance: balance.toString(),
                  balanceUsd: undefined,
                  convertedLast: undefined,
                },
        })
      }
    }

    // Put tokens with balance on top
    getAssetList.sort((a, b) => {
      if (a.balance?.balance === "0") return 1 // Move `null` balances to the end
      if (b.balance?.balance === "0") return -1 // Keep items with balance on top
      return 0 // Retain original order if both have balances
    })

    setAssetList(getAssetList)
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
        <div className="flex-1 flex flex-col justify-between border-b border-gray-100 px-2.5 overflow-y-auto dark:border-black-950">
          {assetList.length ? (
            <AssetList
              assets={
                deferredQuery ? assetList.filter(filterPattern) : assetList
              }
              title={deferredQuery ? "Search results" : "Popular tokens"}
              className="h-full"
              handleSelectToken={handleSelectToken}
              accountId={(payload as ModalSelectAssetsPayload)?.accountId}
            />
          ) : (
            <EmptyAssetList className="h-full" />
          )}
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
