import { Text } from "@radix-ui/themes"
import React, { useState, useDeferredValue } from "react"

import { useModalStore } from "../../providers/ModalStoreProvider"
import type { NetworkTokenWithSwapRoute } from "../../types"
import type { BaseTokenInfo } from "../../types/base"
import { AssetList } from "../Asset/AssetList"
import { SearchBar } from "../SearchBar"

import { WHITELIST_DEPOSIT_TOKENS } from "../../constants/tokens"
import type { ModalType } from "../../stores/modalStore"
import { ModalDialog } from "./ModalDialog"

export type ModalDepositSelectAssetsPayload = {
  modalType?: ModalType.MODAL_DEPOSIT_SELECT_ASSETS
  token?: BaseTokenInfo
}

export const ModalDepositSelectAssets = () => {
  const [searchValue, setSearchValue] = useState("")
  const [assetList, setAssetList] = useState<NetworkTokenWithSwapRoute[]>(
    WHITELIST_DEPOSIT_TOKENS
  )
  const [assetListWithBalances, setAssetListWithBalances] = useState<
    NetworkTokenWithSwapRoute[]
  >([])

  const { onCloseModal, modalType, payload } = useModalStore((state) => state)
  const deferredQuery = useDeferredValue(searchValue)

  const handleSearchClear = () => setSearchValue("")

  const filterPattern = (asset: BaseTokenInfo) =>
    asset.name
      .toLocaleUpperCase()
      .includes(deferredQuery.toLocaleUpperCase()) ||
    asset.chainName
      .toLocaleUpperCase()
      .includes(deferredQuery.toLocaleUpperCase())

  const handleSelectToken = (token: BaseTokenInfo) => {
    onCloseModal({
      ...(payload as { fieldName: string }),
      modalType,
      token,
    })
  }

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
