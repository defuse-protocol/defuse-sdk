import { type Transaction, TransactionMethod } from "../../../types/deposit"

export const FT_STORAGE_DEPOSIT_GAS = "30000000000000"
export const FT_MINIMUM_STORAGE_BALANCE_LARGE = "12500000000000000000000"

export interface DepositFacade {
  createDepositNearTransaction: (
    accountId: string,
    receiverId: string,
    assetId: string,
    amount: string
  ) => unknown
}

export class DepositService implements DepositFacade {
  /**
   * Creates a deposit transaction for NEAR.
   *
   * @param receiverId - The address of the Defuse protocol.
   * @param assetId - The address of the asset being deposited.
   * @param amount - The amount to deposit.
   * @returns An array containing the transaction object.
   *
   * @remarks
   * The `args` object in the returned transaction can be customized:
   * - If `msg` is empty, the asset will be deposited to the caller's address.
   * - To create an intent after deposit, `msg` should be a JSON string with the following structure:
   *   {
   *     "receiver_id": "receiver.near", // required
   *     "execute_intents": [...], // signed intents, optional
   *     "refund_if_failed": true // optional, default: false
   *   }
   */
  createDepositNearTransaction(
    receiverId: string,
    assetId: string,
    amount: string
  ): Transaction[] {
    return [
      {
        receiverId: assetId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: TransactionMethod.FT_TRANSFER_CALL,
              args: {
                reciver_id: receiverId,
                amount,
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
