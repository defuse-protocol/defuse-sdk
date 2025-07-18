import { poaBridge } from "@defuse-protocol/internal-utils"
import type { ReactNode } from "react"
import { NetworkIcon } from "../components/Network/NetworkIcon"

type BlockchainOption = {
  label: string
  icon: ReactNode
  value: poaBridge.BlockchainEnumType
  tags?: string[]
}

type IntentsOption = {
  label: string
  icon: ReactNode
  value: "near_intents"
  tags?: string[]
}

export type NetworkOption = BlockchainOption | IntentsOption

export function isIntentsOption(
  option: NetworkOption
): option is IntentsOption {
  return option.value === "near_intents"
}

export function isBlockchainOption(
  option: NetworkOption
): option is BlockchainOption {
  return option.value !== "near_intents"
}

export function getBlockchainsOptions(): Record<
  poaBridge.BlockchainEnumType,
  BlockchainOption
> {
  const options: Record<poaBridge.BlockchainEnumType, BlockchainOption> = {
    [poaBridge.BlockchainEnum.NEAR]: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName="near"
        />
      ),
      value: poaBridge.BlockchainEnum.NEAR,
      tags: ["vol:4"],
    },
    [poaBridge.BlockchainEnum.ETHEREUM]: {
      label: "Ethereum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName="eth"
        />
      ),
      value: poaBridge.BlockchainEnum.ETHEREUM,
      tags: ["vol:6"],
    },
    [poaBridge.BlockchainEnum.BASE]: {
      label: "Base",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName="base"
        />
      ),
      value: poaBridge.BlockchainEnum.BASE,
      tags: ["vol:9"],
    },
    [poaBridge.BlockchainEnum.ARBITRUM]: {
      label: "Arbitrum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/arbitrum.svg"
          chainName="arbitrum"
        />
      ),
      value: poaBridge.BlockchainEnum.ARBITRUM,
      tags: ["vol:10"],
    },
    [poaBridge.BlockchainEnum.BITCOIN]: {
      label: "Bitcoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/btc.svg"
          chainName="bitcoin"
        />
      ),
      value: poaBridge.BlockchainEnum.BITCOIN,
      tags: ["vol:8"],
    },
    [poaBridge.BlockchainEnum.SOLANA]: {
      label: "Solana",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/solana.svg"
          chainName="solana"
        />
      ),
      value: poaBridge.BlockchainEnum.SOLANA,
      tags: ["vol:3"],
    },
    [poaBridge.BlockchainEnum.DOGECOIN]: {
      label: "Dogecoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/dogecoin.svg"
          chainName="dogecoin"
        />
      ),
      value: poaBridge.BlockchainEnum.DOGECOIN,
      tags: ["vol:7"],
    },
    [poaBridge.BlockchainEnum.TURBOCHAIN]: {
      label: "TurboChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/turbochain.png"
          chainName="turbochain"
        />
      ),
      value: poaBridge.BlockchainEnum.TURBOCHAIN,
      tags: ["vol:102"],
    },
    [poaBridge.BlockchainEnum.AURORA]: {
      label: "Aurora",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/aurora.svg"
          chainName="aurora"
        />
      ),
      value: poaBridge.BlockchainEnum.AURORA,
      tags: ["vol:101"],
    },
    [poaBridge.BlockchainEnum.XRPLEDGER]: {
      label: "XRP Ledger",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/xrpledger.svg"
          chainName="XRP Ledger"
        />
      ),
      value: poaBridge.BlockchainEnum.XRPLEDGER,
      tags: ["vol:10"],
    },
    [poaBridge.BlockchainEnum.ZCASH]: {
      label: "Zcash",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/zcash-icon-black.svg"
          chainName="zcash"
        />
      ),
      value: poaBridge.BlockchainEnum.ZCASH,
      tags: ["vol:1"],
    },
    [poaBridge.BlockchainEnum.GNOSIS]: {
      label: "Gnosis",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/gnosis.svg"
          chainName="Gnosis"
        />
      ),
      value: poaBridge.BlockchainEnum.GNOSIS,
      tags: ["vol:5"],
    },
    [poaBridge.BlockchainEnum.BERACHAIN]: {
      label: "BeraChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/berachain.svg"
          chainName="BeraChain"
        />
      ),
      value: poaBridge.BlockchainEnum.BERACHAIN,
      tags: ["vol:11"],
    },
    [poaBridge.BlockchainEnum.TRON]: {
      label: "Tron",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/tron.svg"
          chainName="Tron"
        />
      ),
      value: poaBridge.BlockchainEnum.TRON,
      tags: ["vol:2"],
    },
    [poaBridge.BlockchainEnum.TUXAPPCHAIN]: {
      label: "TuxaChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/tuxappchain.svg"
          chainName="tuxappchain"
        />
      ),
      value: poaBridge.BlockchainEnum.TUXAPPCHAIN,
      tags: ["vol:103"],
    },
    [poaBridge.BlockchainEnum.VERTEX]: {
      label: "Vertex",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/vertex.svg"
          chainName="vertex"
        />
      ),
      value: poaBridge.BlockchainEnum.VERTEX,
      tags: ["vol:104"],
    },
    [poaBridge.BlockchainEnum.OPTIMA]: {
      label: "Optima",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/optima.svg"
          chainName="optima"
        />
      ),
      value: poaBridge.BlockchainEnum.OPTIMA,
      tags: ["vol:105"],
    },
    [poaBridge.BlockchainEnum.COINEASY]: {
      label: "CoinEasy",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/coineasy.svg"
          chainName="coineasy"
        />
      ),
      value: poaBridge.BlockchainEnum.COINEASY,
      tags: ["vol:106"],
    },
    [poaBridge.BlockchainEnum.POLYGON]: {
      label: "Polygon",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/polygon.svg"
          chainName="Polygon"
        />
      ),
      value: poaBridge.BlockchainEnum.POLYGON,
      tags: [],
    },
    [poaBridge.BlockchainEnum.BSC]: {
      label: "BNB Smart Chain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/bsc.svg"
          chainName="BNB Smart Chain"
        />
      ),
      value: poaBridge.BlockchainEnum.BSC,
      tags: [],
    },
    [poaBridge.BlockchainEnum.HYPERLIQUID]: {
      label: "Hyperliquid",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/hyperliquid.svg"
          chainName="Hyperliquid"
        />
      ),
      value: poaBridge.BlockchainEnum.HYPERLIQUID,
      tags: [],
    },
    [poaBridge.BlockchainEnum.TON]: {
      label: "TON",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ton.svg"
          chainName="TON"
        />
      ),
      value: poaBridge.BlockchainEnum.TON,
      tags: [],
    },
    [poaBridge.BlockchainEnum.OPTIMISM]: {
      label: "Optimism",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/optimism.svg"
          chainName="Optimism"
        />
      ),
      value: poaBridge.BlockchainEnum.OPTIMISM,
      tags: [],
    },
    [poaBridge.BlockchainEnum.AVALANCHE]: {
      label: "Avalanche",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/avalanche.svg"
          chainName="Avalanche"
        />
      ),
      value: poaBridge.BlockchainEnum.AVALANCHE,
      tags: [],
    },
    [poaBridge.BlockchainEnum.SUI]: {
      label: "Sui",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/sui.svg"
          chainName="Sui"
        />
      ),
      value: poaBridge.BlockchainEnum.SUI,
      tags: [],
    },
    [poaBridge.BlockchainEnum.STELLAR]: {
      label: "Stellar",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/stellar.svg"
          chainName="Stellar"
        />
      ),
      value: poaBridge.BlockchainEnum.STELLAR,
      tags: [],
    },
    [poaBridge.BlockchainEnum.APTOS]: {
      label: "Aptos",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/aptos.svg"
          chainName="Aptos"
        />
      ),
      value: poaBridge.BlockchainEnum.APTOS,
      tags: [],
    },
  }

  return sortBlockchainOptionsByVolume(options)
}

function sortBlockchainOptionsByVolume(
  options: Record<poaBridge.BlockchainEnumType, BlockchainOption>
): Record<poaBridge.BlockchainEnumType, BlockchainOption> {
  const sortedEntries = Object.entries(options).sort(([, a], [, b]) => {
    const volTagA = a.tags?.find((tag) => tag.startsWith("vol:"))
    const volTagB = b.tags?.find((tag) => tag.startsWith("vol:"))

    const volA = Number.parseInt(volTagA?.split(":")[1] ?? "0")
    const volB = Number.parseInt(volTagB?.split(":")[1] ?? "0")

    return volA - volB
  })

  return Object.fromEntries(sortedEntries) as Record<
    poaBridge.BlockchainEnumType,
    BlockchainOption
  >
}

export function getNearIntentsOption(): Record<"intents", IntentsOption> {
  return {
    intents: {
      label: "Near Intents",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/intents.svg"
          chainName="Intents"
        />
      ),
      value: "near_intents",
      tags: [],
    },
  }
}
