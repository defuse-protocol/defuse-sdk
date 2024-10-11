import type { BlockchainEnum } from "../machines/depositMachine"

export interface DepositFacade {
  generateDepositAddress: (blockchain: BlockchainEnum) => Promise<string>
  directDepositViaNear: (
    depositAddress: string,
    depositAsset: string,
    depositAmount: string
  ) => Promise<unknown>
}

export class DepositProcessorService implements DepositFacade {
  async generateDepositAddress(blockchain: BlockchainEnum) {
    return "0x0"
  }

  async directDepositViaNear(
    depositAddress: string,
    depositAsset: string,
    depositAmount: string
  ) {
    return true
  }
}
