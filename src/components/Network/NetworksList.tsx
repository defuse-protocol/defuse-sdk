import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import type { ReactNode } from "react"
import { getBlockchainsOptions } from "src/features/deposit/components/DepositForm"
import type { BlockchainEnum } from "src/sdk/poaBridge/constants/blockchains"
import type { SupportedChainName } from "src/types/base"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { isAuroraVirtualChain } from "src/utils/blockchain"
import { PoweredByAuroraLabel } from "../PoweredByAuroraLabel"

interface NetworkListProps {
  networks: BlockchainEnum[]
  selectedNetwork: SupportedChainName | null
  onChangeNetwork: (network: SupportedChainName) => void
  disabled?: boolean
  renderValueDetails?: (address: string) => ReactNode
}

export const NetworkList = ({
  networks,
  selectedNetwork,
  onChangeNetwork,
  disabled = false,
  renderValueDetails,
}: NetworkListProps) => {
  const chains = getBlockchainsOptions()

  return (
    <div
      className={clsx("flex flex-col gap-2", {
        "opacity-50 pointer-events-none": disabled,
      })}
    >
      {networks.map((chain) => (
        <button
          key={chains[chain].value}
          type="button"
          className={clsx(
            "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-3",
            {
              "bg-gray-3":
                selectedNetwork === reverseAssetNetworkAdapter[chain],
            }
          )}
          onClick={() => onChangeNetwork(reverseAssetNetworkAdapter[chain])}
        >
          <div className="flex items-center gap-2">
            {chains[chain].icon}
            <Text as="span" size="3" weight="bold">
              {chains[chain].label}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            {isAuroraVirtualChain(reverseAssetNetworkAdapter[chain]) && (
              <PoweredByAuroraLabel />
            )}
            {renderValueDetails?.(chains[chain].value)}
          </div>
        </button>
      ))}
    </div>
  )
}
