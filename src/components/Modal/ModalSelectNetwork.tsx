import { X as CrossIcon } from "@phosphor-icons/react"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Text } from "@radix-ui/themes"
import { type ReactNode, useMemo, useState } from "react"
import {
  filterBlockchainsOptions,
  getBlockchainsOptions,
} from "src/features/deposit/components/DepositForm"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { BlockchainEnum } from "src/types/interfaces"
import { useModalStore } from "../../providers/ModalStoreProvider"
import { SearchBar } from "../SearchBar"
import { TooltipInfo } from "../TooltipInfo"
import { ModalDialog } from "./ModalDialog"
import { ModalNoResults } from "./ModalNoResults"
import { NetworkList } from "./NetworksList"

export const ModalSelectNetwork = () => {
  const [searchValue, setSearchValue] = useState("")
  const chains = getBlockchainsOptions()
  const { token, selectNetwork, selectedNetwork } = useModalStore(
    (state) => state.payload
  ) as {
    token: BaseTokenInfo | UnifiedTokenInfo
    selectNetwork: (network: BlockchainEnum) => void
    selectedNetwork: BlockchainEnum | null
  }

  const filteredChains = useMemo(() => {
    return Object.fromEntries(
      Object.entries(filterBlockchainsOptions(token)).filter(
        ([key, chain]) =>
          chain.label.toLowerCase().includes(searchValue.toLowerCase()) ||
          chain.value.toLowerCase().includes(searchValue.toLowerCase()) ||
          key.toLowerCase().includes(searchValue.toLowerCase())
      )
    )
  }, [token, searchValue])

  const disabledChains = useMemo(() => {
    const disabledChains: Record<
      string,
      { label: string; icon: ReactNode; value: string }
    > = {}
    Object.values(chains).map((chain) => {
      if (!filteredChains[chain.value]) {
        disabledChains[chain.value] = {
          label: chain.label,
          icon: chain.icon,
          value: chain.value,
        }
      }
    })
    return Object.fromEntries(
      Object.entries(disabledChains).filter(
        ([key, chain]) =>
          chain.label.toLowerCase().includes(searchValue.toLowerCase()) ||
          chain.value.toLowerCase().includes(searchValue.toLowerCase()) ||
          key.toLowerCase().includes(searchValue.toLowerCase())
      )
    )
  }, [chains, filteredChains, searchValue])

  const onChangeNetwork = (network: BlockchainEnum) => {
    selectNetwork(network)
    onCloseModal()
  }

  const { onCloseModal } = useModalStore((state) => state)

  return (
    <ModalDialog>
      <div className="flex flex-col min-h-[680px] md:max-h-[680px] h-full">
        <div className="z-20 h-auto flex-none -mt-[var(--inset-padding-top)] -mr-[var(--inset-padding-right)] -ml-[var(--inset-padding-left)] px-5 pt-7 pb-4 sticky -top-[var(--inset-padding-top)] bg-gray-1">
          <div className="flex flex-col gap-4">
            <div className="flex flex-row justify-between items-center">
              <Text size="5" weight="bold">
                Select network
              </Text>
              <button type="button" onClick={onCloseModal} className="p-3">
                <CrossIcon width={18} height={18} />
              </button>
            </div>
            <SearchBar
              placeholder="Search"
              query={searchValue}
              setQuery={setSearchValue}
            />
          </div>
        </div>

        <div className="z-10 flex-1 overflow-y-auto  -mr-[var(--inset-padding-right)] pr-[var(--inset-padding-right)]">
          {Object.keys({ ...filteredChains, ...disabledChains }).length ===
          0 ? (
            <ModalNoResults
              text="No networks found"
              handleSearchClear={() => setSearchValue("")}
            />
          ) : (
            <div className="flex flex-col gap-2 divide-y divide-gray-300">
              {Object.keys(filteredChains).length > 0 && (
                <div className="flex flex-col gap-2">
                  <NetworkList
                    networks={filteredChains}
                    selectedNetwork={selectedNetwork}
                    onChangeNetwork={onChangeNetwork}
                  />
                </div>
              )}
              {Object.keys(disabledChains).length > 0 && (
                <div className="flex flex-col gap-2 pt-4">
                  <div className="flex flex-row justify-start items-center gap-2">
                    <Text size="1" weight="bold" className="text-gray-500">
                      Unsupported networks
                    </Text>
                    <TooltipInfo
                      icon={
                        <button type="button">
                          <Text asChild>
                            <InfoCircledIcon />
                          </Text>
                        </button>
                      }
                    >
                      The selected asset is not supported on the following
                      networks.
                    </TooltipInfo>
                  </div>
                  <NetworkList
                    disabled
                    networks={disabledChains}
                    selectedNetwork={selectedNetwork}
                    onChangeNetwork={onChangeNetwork}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalDialog>
  )
}
