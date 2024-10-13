export enum BlockchainEnum {
  NEAR = "near",
  ETHEREUM = "ethereum",
  BASE = "base",
}

export type DepositFormNetworkValues = {
  blockchain: BlockchainEnum
}

export interface DepositFormNetworkProps {
  blockchains: {
    [key in BlockchainEnum]: {
      label: BlockchainEnum
      icon: React.ReactNode | null
    }
  }
  onSubmit: (values: DepositFormNetworkValues) => void
}
