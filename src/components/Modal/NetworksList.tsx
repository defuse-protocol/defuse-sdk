import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import type { ReactNode } from "react"
import { isAuroraVirtualChain } from "src/features/deposit/components/DepositForm"
import type { BlockchainEnum } from "src/types/interfaces"
import { PoweredByAuroraLabel } from "../PoweredByAuroraLabel"

interface NetworkListProps {
  networks: Record<string, { label: string; icon: ReactNode; value: string }>
  selectedNetwork: BlockchainEnum | null
  onChangeNetwork: (network: BlockchainEnum) => void
  disabled?: boolean
}

export const NetworkList = ({
  networks,
  selectedNetwork,
  onChangeNetwork,
  disabled = false,
}: NetworkListProps) => {
  return (
    <div
      className={clsx("flex flex-col gap-2", {
        "opacity-50 pointer-events-none": disabled,
      })}
    >
      {Object.values(networks).map((chain) => {
        return (
          <button
            key={chain.value}
            type="button"
            className={clsx(
              "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-3",
              { "bg-gray-3": selectedNetwork === chain.value }
            )}
            onClick={() => onChangeNetwork(chain.value as BlockchainEnum)}
          >
            <div className="flex items-center gap-2">
              {chain.icon}
              <Text weight="bold">{chain.label}</Text>
            </div>
            <div className="flex items-center gap-2">
              {isAuroraVirtualChain(chain.value as BlockchainEnum) && (
                <PoweredByAuroraLabel />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
