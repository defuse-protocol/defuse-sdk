import {
  type BlockchainEnum,
  type Transaction,
  TransactionMethod,
} from "../../../types/deposit"

export const FT_MAX_GAS_TRANSACTION = `300${"0".repeat(12)}`

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
                receiver_id: receiverId,
                amount,
                msg: "",
              },
              gas: FT_MAX_GAS_TRANSACTION,
              deposit: "1",
            },
          },
        ],
      },
    ]
  }

  /**
   * Generate a deposit address for the specified blockchain and asset through the POA bridge API call.
   *
   * @param blockchain - The blockchain for which to generate the address
   * @param assetAddress - The address of the asset being deposited
   * @returns A Promise that resolves to the generated deposit address
   */
  async generateDepositAddress(
    blockchain: BlockchainEnum,
    assetAddress: string
  ): Promise<string> {
    try {
      // TODO: Replace with actual API call
      return new Promise((resolve) => {
        resolve("0x0")
      })
    } catch (error) {
      console.error("Error generating deposit address:", error)
      throw error
    }
  }
}
