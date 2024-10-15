import type { BlockchainEnum } from "../../../types/deposit"

export interface DepositFacade {
  createDepositNearTransaction: (
    senderAddress: string,
    assetAddress: string,
    amount: string
  ) => unknown
}
export const FT_STORAGE_DEPOSIT_GAS = "30000000000000"
export const FT_MINIMUM_STORAGE_BALANCE_LARGE = "12500000000000000000000"

export enum TransactionMethod {
  FT_ON_TRANSFER = "ft_on_transfer",
}

export class DepositService implements DepositFacade {
  createDepositNearTransaction(
    senderAddress: string,
    assetAddress: string,
    amount: string
  ) {
    console.log("new DepositService", senderAddress, assetAddress, amount)

    const message = Buffer.from("").toString("base64")
    return [
      {
        receiverId: "defuse.near",
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: TransactionMethod.FT_ON_TRANSFER,
              args: {
                sender_id: senderAddress,
                amount,
                message: "",
              },
              gas: FT_STORAGE_DEPOSIT_GAS,
              deposit: FT_MINIMUM_STORAGE_BALANCE_LARGE,
            },
          },
        ],
      },
    ]
  }
}
