import { X as CrossIcon } from "@phosphor-icons/react"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Text } from "@radix-ui/themes"
import { type ReactNode, useMemo, useState } from "react"
import type { NetworkOptions } from "../../hooks/useNetworkLists"
import type { BlockchainEnum } from "../../sdk/poaBridge/constants/blockchains"
import type { SupportedChainName } from "../../types/base"
import { filterChains } from "../../utils/blockchain"
import { BaseModalDialog } from "../Modal/ModalDialog"
import { ModalNoResults } from "../Modal/ModalNoResults"
import { SearchBar } from "../SearchBar"
import { TooltipInfo } from "../TooltipInfo"
import { NetworkList } from "./NetworksList"

interface ModalSelectNetworkProps {
  selectNetwork: (network: SupportedChainName) => void
  selectedNetwork: SupportedChainName | null
  isOpen?: boolean
  onClose: () => void
  renderValueDetails?: (address: string) => ReactNode
  availableNetworks: NetworkOptions
  disabledNetworks: NetworkOptions
}

export const ModalSelectNetwork = ({
  selectNetwork,
  selectedNetwork,
  isOpen,
  onClose,
  renderValueDetails,
  availableNetworks,
  disabledNetworks,
}: ModalSelectNetworkProps) => {
  const [searchValue, setSearchValue] = useState("")

  const filteredAvailableNetworks = useMemo(() => {
    const filtered = filterChains(availableNetworks, searchValue)
    return Object.keys(filtered).map((key) => key as BlockchainEnum)
  }, [availableNetworks, searchValue])

  const filteredDisabledNetworks = useMemo(() => {
    const filtered = filterChains(disabledNetworks, searchValue)
    return Object.keys(filtered).map((key) => key as BlockchainEnum)
  }, [disabledNetworks, searchValue])

  const onChangeNetwork = (network: SupportedChainName) => {
    selectNetwork(network)
    onClose()
  }

  return (
    <BaseModalDialog open={!!isOpen} onClose={onClose} isDismissable>
      <div className="flex flex-col min-h-[680px] md:max-h-[680px] h-full">
        <div className="z-20 h-auto flex-none -mt-[var(--inset-padding-top)] -mr-[var(--inset-padding-right)] -ml-[var(--inset-padding-left)] px-5 pt-7 pb-4 sticky -top-[var(--inset-padding-top)] bg-gray-1">
          <div className="flex flex-col gap-4">
            <div className="flex flex-row justify-between items-center">
              <Text size="5" weight="bold">
                Select network
              </Text>
              <button type="button" onClick={onClose} className="p-3">
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
          {[...filteredAvailableNetworks, ...filteredDisabledNetworks]
            .length === 0 ? (
            <ModalNoResults
              text="No networks found"
              handleSearchClear={() => setSearchValue("")}
            />
          ) : (
            <div className="flex flex-col gap-2 divide-y divide-gray-300">
              {filteredAvailableNetworks.length > 0 && (
                <div className="flex flex-col gap-2">
                  <NetworkList
                    networks={filteredAvailableNetworks}
                    selectedNetwork={selectedNetwork}
                    onChangeNetwork={onChangeNetwork}
                    renderValueDetails={renderValueDetails}
                  />
                </div>
              )}
              {filteredDisabledNetworks.length > 0 && (
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
                    networks={filteredDisabledNetworks}
                    selectedNetwork={selectedNetwork}
                    onChangeNetwork={onChangeNetwork}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseModalDialog>
  )
}
