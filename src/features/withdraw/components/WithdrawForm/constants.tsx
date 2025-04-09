import type { ReactNode } from "react"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import type { SupportedChainName } from "../../../../types/base"

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
] as const satisfies Array<{
  label: string
  icon: ReactNode
  value: SupportedChainName
}>
