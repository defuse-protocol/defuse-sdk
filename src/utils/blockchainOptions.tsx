import type { ReactNode } from "react"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import { NetworkReference } from "src/sdk/poaBridge/constants/blockchains"

type BlockchainOption = {
  label: string
  icon: ReactNode
  value: NetworkReference
  tags?: string[]
}

export function getBlockchainsOptions(): Record<
  NetworkReference,
  BlockchainOption
> {
  const options: Record<
    Exclude<NetworkReference, typeof NetworkReference.HYPERLIQUID>,
    BlockchainOption
  > = {
    [NetworkReference.NEAR]: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName="near"
        />
      ),
      value: NetworkReference.NEAR,
      tags: ["vol:4"],
    },
    [NetworkReference.ETHEREUM]: {
      label: "Ethereum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName="eth"
        />
      ),
      value: NetworkReference.ETHEREUM,
      tags: ["vol:6"],
    },
    [NetworkReference.BASE]: {
      label: "Base",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName="base"
        />
      ),
      value: NetworkReference.BASE,
      tags: ["vol:9"],
    },
    [NetworkReference.ARBITRUM]: {
      label: "Arbitrum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/arbitrum.svg"
          chainName="arbitrum"
        />
      ),
      value: NetworkReference.ARBITRUM,
      tags: ["vol:10"],
    },
    [NetworkReference.BITCOIN]: {
      label: "Bitcoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/btc.svg"
          chainName="bitcoin"
        />
      ),
      value: NetworkReference.BITCOIN,
      tags: ["vol:8"],
    },
    [NetworkReference.SOLANA]: {
      label: "Solana",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/solana.svg"
          chainName="solana"
        />
      ),
      value: NetworkReference.SOLANA,
      tags: ["vol:3"],
    },
    [NetworkReference.DOGECOIN]: {
      label: "Dogecoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/dogecoin.svg"
          chainName="dogecoin"
        />
      ),
      value: NetworkReference.DOGECOIN,
      tags: ["vol:7"],
    },
    [NetworkReference.TURBOCHAIN]: {
      label: "TurboChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/turbochain.png"
          chainName="turbochain"
        />
      ),
      value: NetworkReference.TURBOCHAIN,
      tags: ["vol:102"],
    },
    [NetworkReference.AURORA]: {
      label: "Aurora",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/aurora.svg"
          chainName="aurora"
        />
      ),
      value: NetworkReference.AURORA,
      tags: ["vol:101"],
    },
    [NetworkReference.XRPLEDGER]: {
      label: "XRP Ledger",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/xrpledger.svg"
          chainName="XRP Ledger"
        />
      ),
      value: NetworkReference.XRPLEDGER,
      tags: ["vol:10"],
    },
    [NetworkReference.ZCASH]: {
      label: "Zcash",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/zcash-icon-black.svg"
          chainName="zcash"
        />
      ),
      value: NetworkReference.ZCASH,
      tags: ["vol:1"],
    },
    [NetworkReference.GNOSIS]: {
      label: "Gnosis",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/gnosis.svg"
          chainName="Gnosis"
        />
      ),
      value: NetworkReference.GNOSIS,
      tags: ["vol:5"],
    },
    [NetworkReference.BERACHAIN]: {
      label: "BeraChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/berachain.svg"
          chainName="BeraChain"
        />
      ),
      value: NetworkReference.BERACHAIN,
      tags: ["vol:11"],
    },
    [NetworkReference.TRON]: {
      label: "Tron",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/tron.svg"
          chainName="Tron"
        />
      ),
      value: NetworkReference.TRON,
      tags: ["vol:2"],
    },
    [NetworkReference.TUXAPPCHAIN]: {
      label: "TuxaChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/tuxappchain.svg"
          chainName="tuxappchain"
        />
      ),
      value: NetworkReference.TUXAPPCHAIN,
      tags: ["vol:103"],
    },
    [NetworkReference.VERTEX]: {
      label: "Vertex",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/vertex.svg"
          chainName="vertex"
        />
      ),
      value: NetworkReference.VERTEX,
      tags: ["vol:104"],
    },
    [NetworkReference.OPTIMA]: {
      label: "Optima",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/optima.svg"
          chainName="optima"
        />
      ),
      value: NetworkReference.OPTIMA,
      tags: ["vol:105"],
    },
    [NetworkReference.COINEASY]: {
      label: "CoinEasy",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/coineasy.svg"
          chainName="coineasy"
        />
      ),
      value: NetworkReference.COINEASY,
      tags: ["vol:106"],
    },
    [NetworkReference.POLYGON]: {
      label: "Polygon",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/polygon.svg"
          chainName="Polygon"
        />
      ),
      value: NetworkReference.POLYGON,
      tags: [],
    },
    [NetworkReference.BSC]: {
      label: "Binance Smart Chain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/bsc.svg"
          chainName="Binance Smart Chain"
        />
      ),
      value: NetworkReference.BSC,
      tags: [],
    },
  }

  return sortBlockchainOptionsByVolume(options)
}

function sortBlockchainOptionsByVolume(
  options: Record<
    Exclude<NetworkReference, typeof NetworkReference.HYPERLIQUID>,
    BlockchainOption
  >
): Record<NetworkReference, BlockchainOption> {
  const sortedEntries = Object.entries(options).sort(([, a], [, b]) => {
    const volTagA = a.tags?.find((tag) => tag.startsWith("vol:"))
    const volTagB = b.tags?.find((tag) => tag.startsWith("vol:"))

    const volA = Number.parseInt(volTagA?.split(":")[1] ?? "0")
    const volB = Number.parseInt(volTagB?.split(":")[1] ?? "0")

    return volA - volB
  })

  return Object.fromEntries(sortedEntries) as Record<
    NetworkReference,
    BlockchainOption
  >
}
