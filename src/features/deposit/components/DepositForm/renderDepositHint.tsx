import { Callout } from "@radix-ui/themes"
import { BlockchainEnum } from "../../../../sdk/poaBridge/constants/blockchains"
import type { BaseTokenInfo } from "../../../../types/base"
import { formatTokenValue } from "../../../../utils/format"

const networkSelectToLabel: Record<BlockchainEnum, string> = {
  [BlockchainEnum.NEAR]: "NEAR",
  [BlockchainEnum.ETHEREUM]: "Ethereum",
  [BlockchainEnum.BASE]: "Base",
  [BlockchainEnum.ARBITRUM]: "Arbitrum",
  [BlockchainEnum.BITCOIN]: "Bitcoin",
  [BlockchainEnum.SOLANA]: "Solana",
  [BlockchainEnum.DOGECOIN]: "Dogecoin",
  [BlockchainEnum.TURBOCHAIN]: "TurboChain",
  [BlockchainEnum.AURORA]: "Aurora",
  [BlockchainEnum.XRPLEDGER]: "XRP Ledger",
  [BlockchainEnum.ZCASH]: "Zcash",
  [BlockchainEnum.GNOSIS]: "Gnosis",
  [BlockchainEnum.BERACHAIN]: "BeraChain",
  [BlockchainEnum.TRON]: "Tron",
}

export function renderDepositHint(
  network: BlockchainEnum,
  token: BaseTokenInfo
) {
  return (
    <div className="flex flex-col gap-4">
      <Callout.Root className="bg-warning px-3 py-2 text-warning-foreground">
        <Callout.Text className="text-xs">
          <span className="font-bold">
            {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
            Only deposit {token.symbol} from the {networkSelectToLabel[network]}{" "}
            network.
            {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
          </span>{" "}
          <span>
            Depositing other assets or using a different network will result in
            loss of funds.
          </span>
        </Callout.Text>
      </Callout.Root>
    </div>
  )
}

export function renderMinDepositAmountHint(
  minDepositAmount: bigint,
  token: BaseTokenInfo
) {
  return (
    <div className="flex flex-col gap-3.5 font-medium text-gray-11 text-xs">
      <div className="flex justify-between">
        <div>Minimum deposit</div>
        <div className="text-label">
          {formatTokenValue(minDepositAmount, token.decimals)} {token.symbol}
        </div>
      </div>
    </div>
  )
}
