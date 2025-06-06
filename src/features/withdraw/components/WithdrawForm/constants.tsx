import type { ReactNode } from "react"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import type { SupportedChainName } from "../../../../types/base"
import type { IntentsUserId } from "../../../../types/intentsUserId"

export const allBlockchains = [
  {
    label: "Near",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/near_dark.svg"
        chainName="Near"
      />
    ),
    value: "near",
  },
  {
    label: "Ethereum",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/ethereum.svg"
        chainName="Ethereum"
      />
    ),
    value: "eth",
  },
  {
    label: "Base",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/base.svg"
        chainName="Base"
      />
    ),
    value: "base",
  },
  {
    label: "Arbitrum",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/arbitrum.svg"
        chainName="Arbitrum"
      />
    ),
    value: "arbitrum",
  },
  {
    label: "Bitcoin",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/btc.svg"
        chainName="Bitcoin"
      />
    ),
    value: "bitcoin",
  },
  {
    label: "Solana",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/solana.svg"
        chainName="Solana"
      />
    ),
    value: "solana",
  },
  {
    label: "Dogecoin",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/dogecoin.svg"
        chainName="Dogecoin"
      />
    ),
    value: "dogecoin",
  },
  {
    label: "TurboChain",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/turbochain.png"
        chainName="TurboChain"
      />
    ),
    value: "turbochain",
  },
  {
    label: "Aurora",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/aurora.svg"
        chainName="Aurora"
      />
    ),
    value: "aurora",
  },
  {
    label: "XRP Ledger",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/xrpledger.svg"
        chainName="XRP Ledger"
      />
    ),
    value: "xrpledger",
  },
  {
    label: "Zcash",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/zcash-icon-black.svg"
        chainName="Zcash"
      />
    ),
    value: "zcash",
  },
  {
    label: "Gnosis",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/gnosis.svg"
        chainName="Gnosis"
      />
    ),
    value: "gnosis",
  },
  {
    label: "BeraChain",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/berachain.svg"
        chainName="BeraChain"
      />
    ),
    value: "berachain",
  },
  {
    label: "Tron",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/tron.svg"
        chainName="Tron"
      />
    ),
    value: "tron",
  },
  {
    label: "TuxaChain",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/tuxappchain.svg"
        chainName="TuxaChain"
      />
    ),
    value: "tuxappchain",
  },
  {
    label: "Vertex",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/vertex.svg"
        chainName="Vertex"
      />
    ),
    value: "vertex",
  },
  {
    label: "Optima",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/optima.svg"
        chainName="Optima"
      />
    ),
    value: "optima",
  },
  {
    label: "CoinEasy",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/coineasy.svg"
        chainName="CoinEasy"
      />
    ),
    value: "coineasy",
  },
  {
    label: "Polygon",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/polygon.svg"
        chainName="Polygon"
      />
    ),
    value: "polygon",
  },
  {
    label: "BNB Smart Chain",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/bsc.svg"
        chainName="BNB Smart Chain"
      />
    ),
    value: "bsc",
  },
  {
    label: "Hyperliquid",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/hyperliquid.svg"
        chainName="Hyperliquid"
      />
    ),
    value: "hyperliquid",
  },
] as const satisfies Array<{
  label: string
  icon: ReactNode
  value: SupportedChainName
}>

type TypeEqualityGuard<A, B> = Exclude<A, B> | Exclude<B, A> extends never
  ? true
  : never
const _typeCheck: TypeEqualityGuard<
  SupportedChainName,
  (typeof allBlockchains)[number]["value"]
> = true

export const SolverId = "solver-multichain-asset.near" as IntentsUserId // currently we have only this multychain solver
