import type { ReactNode } from "react"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import { BlockchainEnum } from "src/sdk/poaBridge/constants/blockchains"

export function getBlockchainsOptions(): Record<
  BlockchainEnum,
  { label: string; icon: ReactNode; value: BlockchainEnum }
> {
  return {
    [BlockchainEnum.NEAR]: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName="near"
        />
      ),
      value: BlockchainEnum.NEAR,
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
    },
  }
}
