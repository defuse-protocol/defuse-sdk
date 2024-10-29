import { getNearTxSuccessValue } from "src/features/machines/getTxMachine"
import {
  getDepositAddress,
  getSupportedTokens,
} from "src/services/poaBridgeClient"
import type { DepositBlockchainEnum, Transaction } from "../../../types/deposit"

export const FT_MAX_GAS_TRANSACTION = `300${"0".repeat(12)}` // 300 TGAS
export const FT_DEPOSIT_GAS = `30${"0".repeat(12)}` // 30 TGAS

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
              methodName: "ft_transfer_call",
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

  createBatchDepositNearTransaction(
    receiverId: string,
    assetId: string,
    fungibleAmount: string,
    nativeAmount: string
  ): Transaction[] {
    return [
      {
        receiverId: assetId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "near_deposit",
              args: {},
              gas: FT_DEPOSIT_GAS,
              deposit: nativeAmount,
            },
          },
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: {
                receiver_id: receiverId,
                amount: fungibleAmount,
                msg: "",
              },
              gas: `270${"0".repeat(12)}`, // Reduced to 270 TGAS
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
   * @param accountId - The address of the asset being deposited
   * @returns A Promise that resolves to the generated deposit address
   */
  async generateDepositAddress(
    accountId: string,
    defuseAssetId: string
  ): Promise<string> {
    try {
      if (!defuseAssetId) {
        throw new Error("Defuse asset ID is required")
      }
      const [blockchain, network] = defuseAssetId.split(":")
      const supportedTokens = await getSupportedTokens({
        chains: [`${blockchain}:${network}`],
      })

      if (supportedTokens.tokens.length === 0) {
        throw new Error("No supported tokens found")
      }

      const generatedDepositAddress = await getDepositAddress({
        account_id: accountId,
        chain: `${blockchain}:${network}`,
      })

      return generatedDepositAddress.address
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
    if (!txHash) {
      throw new Error("Transaction hash is required")
    }
    const successValue = await getNearTxSuccessValue({
      txHash,
      senderAccountId: accountId,
    })
    // Check if input amount is equal to the success value
    return successValue === BigInt(amount)
  }
}
