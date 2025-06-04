import type { ReactNode } from "react"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import { BlockchainEnum } from "src/sdk/poaBridge/constants/blockchains"

type BlockchainOption = {
  label: string
  icon: ReactNode
  value: BlockchainEnum
  tags?: string[]
}

export function getBlockchainsOptions(): Record<
  BlockchainEnum,
  BlockchainOption
> {
  const options: Record<
    Exclude<BlockchainEnum, BlockchainEnum.HYPERLIQUID>,
    BlockchainOption
  > = {
    [BlockchainEnum.NEAR]: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName="near"
        />
      ),
      value: BlockchainEnum.NEAR,
      tags: ["vol:4"],
    },
    [BlockchainEnum.ETHEREUM]: {
      label: "Ethereum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName="eth"
        />
      ),
      value: BlockchainEnum.ETHEREUM,
      tags: ["vol:6"],
    },
    [BlockchainEnum.BASE]: {
      label: "Base",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName="base"
        />
      ),
      value: BlockchainEnum.BASE,
      tags: ["vol:9"],
    },
    [BlockchainEnum.ARBITRUM]: {
      label: "Arbitrum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/arbitrum.svg"
          chainName="arbitrum"
        />
      ),
      value: BlockchainEnum.ARBITRUM,
      tags: ["vol:10"],
    },
    [BlockchainEnum.BITCOIN]: {
      label: "Bitcoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/btc.svg"
          chainName="bitcoin"
        />
      ),
      value: BlockchainEnum.BITCOIN,
      tags: ["vol:8"],
    },
    [BlockchainEnum.SOLANA]: {
      label: "Solana",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/solana.svg"
          chainName="solana"
        />
      ),
      value: BlockchainEnum.SOLANA,
      tags: ["vol:3"],
    },
    [BlockchainEnum.DOGECOIN]: {
      label: "Dogecoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/dogecoin.svg"
          chainName="dogecoin"
        />
      ),
      value: BlockchainEnum.DOGECOIN,
      tags: ["vol:7"],
    },
    [BlockchainEnum.TURBOCHAIN]: {
      label: "TurboChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/turbochain.png"
          chainName="turbochain"
        />
      ),
      value: BlockchainEnum.TURBOCHAIN,
      tags: ["vol:102"],
    },
    [BlockchainEnum.AURORA]: {
      label: "Aurora",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/aurora.svg"
          chainName="aurora"
        />
      ),
      value: BlockchainEnum.AURORA,
      tags: ["vol:101"],
    },
    [BlockchainEnum.XRPLEDGER]: {
      label: "XRP Ledger",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/xrpledger.svg"
          chainName="XRP Ledger"
        />
      ),
      value: BlockchainEnum.XRPLEDGER,
      tags: ["vol:10"],
    },
    [BlockchainEnum.ZCASH]: {
      label: "Zcash",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/zcash-icon-black.svg"
          chainName="zcash"
        />
      ),
      value: BlockchainEnum.ZCASH,
      tags: ["vol:1"],
    },
    [BlockchainEnum.GNOSIS]: {
      label: "Gnosis",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/gnosis.svg"
          chainName="Gnosis"
        />
      ),
      value: BlockchainEnum.GNOSIS,
      tags: ["vol:5"],
    },
    [BlockchainEnum.BERACHAIN]: {
      label: "BeraChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/berachain.svg"
          chainName="BeraChain"
        />
      ),
      value: BlockchainEnum.BERACHAIN,
      tags: ["vol:11"],
    },
    [BlockchainEnum.TRON]: {
      label: "Tron",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/tron.svg"
          chainName="Tron"
        />
      ),
      value: BlockchainEnum.TRON,
      tags: ["vol:2"],
    },
    [BlockchainEnum.TUXAPPCHAIN]: {
      label: "TuxaChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/tuxappchain.svg"
          chainName="tuxappchain"
        />
      ),
      value: BlockchainEnum.TUXAPPCHAIN,
      tags: ["vol:103"],
    },
    [BlockchainEnum.VERTEX]: {
      label: "Vertex",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/vertex.svg"
          chainName="vertex"
        />
      ),
      value: BlockchainEnum.VERTEX,
      tags: ["vol:104"],
    },
    [BlockchainEnum.OPTIMA]: {
      label: "Optima",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/optima.svg"
          chainName="optima"
        />
      ),
      value: BlockchainEnum.OPTIMA,
      tags: ["vol:105"],
    },
    [BlockchainEnum.COINEASY]: {
      label: "CoinEasy",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/coineasy.svg"
          chainName="coineasy"
        />
      ),
      value: BlockchainEnum.COINEASY,
      tags: ["vol:106"],
    },
    [BlockchainEnum.POLYGON]: {
      label: "Polygon",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/polygon.svg"
          chainName="Polygon"
        />
      ),
      value: BlockchainEnum.POLYGON,
      tags: [],
    },
    [BlockchainEnum.BSC]: {
      label: "Binance Smart Chain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/bsc.svg"
          chainName="Binance Smart Chain"
        />
      ),
      value: BlockchainEnum.BSC,
      tags: [],
    },
  }

  return sortBlockchainOptionsByVolume(options)
}

function sortBlockchainOptionsByVolume(
  options: Record<
    Exclude<BlockchainEnum, BlockchainEnum.HYPERLIQUID>,
    BlockchainOption
  >
): Record<BlockchainEnum, BlockchainOption> {
  const sortedEntries = Object.entries(options).sort(([, a], [, b]) => {
    const volTagA = a.tags?.find((tag) => tag.startsWith("vol:"))
    const volTagB = b.tags?.find((tag) => tag.startsWith("vol:"))

    const volA = Number.parseInt(volTagA?.split(":")[1] ?? "0")
    const volB = Number.parseInt(volTagB?.split(":")[1] ?? "0")

    return volA - volB
  })

  return Object.fromEntries(sortedEntries) as Record<
    BlockchainEnum,
    BlockchainOption
  >
}
