import { X as CrossIcon } from "@phosphor-icons/react"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Text } from "@radix-ui/themes"
import { type ReactNode, useMemo, useState } from "react"
import {
  availableChainsForToken,
  getBlockchainsOptions,
} from "src/features/deposit/components/DepositForm"
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "src/types/base"
import type { BlockchainEnum } from "src/types/interfaces"
import { filterChains } from "src/utils/blockchain"
import { BaseModalDialog } from "../Modal/ModalDialog"
import { ModalNoResults } from "../Modal/ModalNoResults"
import { SearchBar } from "../SearchBar"
import { TooltipInfo } from "../TooltipInfo"
import { NetworkList } from "./NetworksList"

interface ModalSelectNetworkProps {
  token: BaseTokenInfo | UnifiedTokenInfo
  selectNetwork: (network: SupportedChainName) => void
  selectedNetwork: SupportedChainName | null
  isOpen?: boolean
  onClose: () => void
}

export const ModalSelectNetwork = ({
  token,
  selectNetwork,
  selectedNetwork,
  isOpen,
  onClose,
}: ModalSelectNetworkProps) => {
  const [searchValue, setSearchValue] = useState("")
  const chains = getBlockchainsOptions()

  const availableChains = useMemo(() => availableChainsForToken(token), [token])
  const filteredChains = filterChains(availableChains, searchValue)

  const disabledChains = () => {
    const disabledChains: Record<
      string,
      { label: string; icon: ReactNode; value: string }
    > = {}
    Object.values(chains).map((chain) => {
      if (!filteredChains[chain.value]) {
        disabledChains[chain.value] = chain
      }
    })
    return filterChains(disabledChains, searchValue)
  }

  const onChangeNetwork = (network: SupportedChainName) => {
    selectNetwork(network)
    onClose()
  }

  const availableNetworks = Object.keys(filteredChains).map(
    (key) => key as BlockchainEnum
  )
  const disabledNetworks = Object.keys(disabledChains()).map(
    (key) => key as BlockchainEnum
  )

  return (
    <BaseModalDialog open={!!isOpen}>
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
                    networks={availableNetworks}
                    selectedNetwork={selectedNetwork}
                    onChangeNetwork={onChangeNetwork}
                  />
                </div>
              )}
              {Object.keys(disabledNetworks).length > 0 && (
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
                    networks={disabledNetworks}
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
