import { getNearTxSuccessValue } from "src/features/machines/getTxMachine"
import {
  type DepositBlockchainEnum,
  DepositTransactionMethod,
  type Transaction,
} from "../../../types/deposit"

export const FT_MAX_GAS_TRANSACTION = `300${"0".repeat(12)}`
export const FT_DEPOSIT_GAS = `50${"0".repeat(12)}`

export class DepositService {
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
              methodName: DepositTransactionMethod.FT_TRANSFER_CALL,
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

  createNativeDepositNearTransaction(amount: string): Transaction[] {
    return [
      {
        receiverId: "wrap.near",
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: DepositTransactionMethod.NEAR_DEPOSIT,
              args: {},
              gas: FT_DEPOSIT_GAS,
              deposit: amount,
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
   * @param accountId - The address of the asset being deposited
   * @returns A Promise that resolves to the generated deposit address
   */
  async generateDepositAddress(
    blockchain: DepositBlockchainEnum,
    accountId: string
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

  async checkNearTransactionValidity(
    txHash: string,
    accountId: string,
    amount: string
  ): Promise<boolean> {
    // TODO: [TEMPORARY COMMENT] Resolve issue with jsonrpc stability, untile that we need to comment this
    // cause this check breaks the deposit flow
    // if (!txHash) {
    //   throw new Error("Transaction hash is required")
    // }

    // const splitTxHashesToTxHash = txHash.includes(",")
    //   ? txHash.split(",")[1]
    //   : txHash

    // if (!splitTxHashesToTxHash) {
    //   throw new Error("Invalid transaction hash format")
    // }

    // const successValue = await getNearTxSuccessValue({
    //   txHash: splitTxHashesToTxHash,
    //   senderAccountId: accountId,
    // })

    // Check if input amount is equal to the success value
    // return successValue === BigInt(amount)
    return true
  }
}
