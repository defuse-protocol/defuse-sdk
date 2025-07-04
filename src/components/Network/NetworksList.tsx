import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import type { ReactNode } from "react"
import type { NetworkOptions } from "src/hooks/useNetworkLists"
import { config } from "../../config"
import type { SupportedChainName } from "../../types/base"
import { reverseAssetNetworkAdapter } from "../../utils/adapters"
import { isAuroraVirtualChain } from "../../utils/blockchain"
import { PoweredByAuroraLabel } from "../PoweredByAuroraLabel"

interface NetworkListProps {
  networkOptions: NetworkOptions
  selectedNetwork: SupportedChainName | null
  onChangeNetwork: (network: SupportedChainName) => void
  disabled?: boolean
  renderValueDetails?: (address: string) => ReactNode
}

export const NetworkList = ({
  networkOptions,
  selectedNetwork,
  onChangeNetwork,
  disabled = false,
  renderValueDetails,
}: NetworkListProps) => {
  return (
    <div
      className={clsx("flex flex-col gap-2", {
        "opacity-50 pointer-events-none": disabled,
      })}
    >
      {Object.keys(networkOptions).map((network) => {
        const networkInfo = networkOptions[network]
        if (!networkInfo) return null

        // Special case: Handle Intents internal transfers which exist outside the standard blockchain options.
        if ((network as string) === "intents" && config.features.intents) {
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          const intents = networkOptions.intents as any
          return (
            <button
              key={intents.value}
              type="button"
              className={clsx(
                "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-3",
                {
                  "bg-gray-3": selectedNetwork === intents.value,
                }
              )}
              onClick={() => onChangeNetwork(intents.value)}
            >
              <div className="flex items-center gap-2">
                {intents.icon}
                <Text as="span" size="3" weight="bold">
                  {intents.label}
                </Text>
              </div>
              <div className="flex items-center py-1 px-2 rounded-full bg-[#E1F9EA] text-[#17A615]">
                <span className="text-xs">internal</span>
              </div>
            </button>
          )
        }

        // Validate that the network key is a valid BlockchainEnum key
        if (!isValidBlockchainEnumKey(network)) {
          return null // Skip invalid network keys
        }

        const supportedChainName = reverseAssetNetworkAdapter[network]

        // Normal case: Render standard blockchain options.
        return (
          <button
            key={networkInfo.value}
            type="button"
            className={clsx(
              "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-3",
              {
                "bg-gray-3": selectedNetwork === supportedChainName,
              }
            )}
            onClick={() => onChangeNetwork(supportedChainName)}
          >
            <div className="flex items-center gap-2">
              {networkInfo.icon}
              <Text as="span" size="3" weight="bold">
                {networkInfo.label}
              </Text>
              {isAuroraVirtualChain(supportedChainName) && (
                <PoweredByAuroraLabel />
              )}
            </div>
            <div className="flex items-center gap-2">
              {renderValueDetails?.(networkInfo.value)}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function isValidBlockchainEnumKey(
  key: string
): key is keyof typeof reverseAssetNetworkAdapter {
  return key in reverseAssetNetworkAdapter
}
