import { BlockchainEnum } from "../../../types/deposit"
import { DepositFormNetwork } from "./Form/DepositFormNetwork/DepositFormNetwork"

const supportedBlockchains = {
  [BlockchainEnum.NEAR]: {
    label: BlockchainEnum.NEAR,
    icon: null,
  },
  [BlockchainEnum.ETHEREUM]: {
    label: BlockchainEnum.ETHEREUM,
    icon: null,
  },
  [BlockchainEnum.BASE]: {
    label: BlockchainEnum.BASE,
    icon: null,
  },
}

export const DepositWidget = () => {
  return (
    <DepositFormNetwork
      blockchains={supportedBlockchains}
      onSubmit={() => {}}
    />
  )
}
