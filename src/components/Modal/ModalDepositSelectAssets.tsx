import { Text } from "@radix-ui/themes"
import React, { useState, useDeferredValue, useEffect } from "react"

import { useModalStore } from "../../providers/ModalStoreProvider"
import type { BaseTokenInfo } from "../../types/base"
import { BlockchainEnum } from "../../types/deposit"
import { AssetList } from "../Asset/AssetList"
import { SearchBar } from "../SearchBar"

import {
  EVM_WHITELIST_DEPOSIT_TOKENS,
  NEAR_WHITELIST_DEPOSIT_TOKENS,
} from "../../constants/tokens"
import type { ModalType } from "../../stores/modalStore"
import { ModalDialog } from "./ModalDialog"

export type ModalDepositSelectAssetsPayload = {
  modalType?: ModalType.MODAL_DEPOSIT_SELECT_ASSETS
  blockchain?: BlockchainEnum
  token?: BaseTokenInfo
}

export const ModalDepositSelectAssets = () => {
  const [searchValue, setSearchValue] = useState("")
  const [assetList, setAssetList] = useState<BaseTokenInfo[]>([])

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

  const handleSelectToken = ({ token }: { token: BaseTokenInfo }) => {
    onCloseModal({
      ...(payload as { fieldName: string }),
      modalType,
      token,
    })
  }

  useEffect(() => {
    const payloadData = payload as ModalDepositSelectAssetsPayload
    switch (payloadData?.blockchain) {
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
        setAssetList(EVM_WHITELIST_DEPOSIT_TOKENS)
        break
      case BlockchainEnum.NEAR:
        setAssetList(NEAR_WHITELIST_DEPOSIT_TOKENS)
        break
    }
  }, [payload])

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
          <AssetList
            assets={(deferredQuery
              ? assetList.filter(filterPattern)
              : assetList
            ).map((token) => ({
              token,
              disabled: false,
            }))}
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
