import { settings } from "../../../config/settings"
import {
  getDepositAddress,
  getSupportedTokens,
} from "../../../services/poaBridgeClient"
import type { BlockchainEnum } from "../../../types"
import type { Transaction } from "../../../types/deposit"
import type { DefuseUserId } from "../../../utils/defuse"
import {
  getNearNep141MinStorageBalance,
  getNearNep141StorageBalance,
} from "../../machines/getBalanceMachine"
import { getNearTxSuccessValue } from "../../machines/getTxMachine"

const FT_DEPOSIT_GAS = `30${"0".repeat(12)}` // 30 TGAS
const FT_TRANSFER_GAS = `50${"0".repeat(12)}` // 30 TGAS

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
  createBatchDepositNearNep141Transaction(
    assetAccountId: string,
    amount: bigint,
    isStorageDepositRequired: boolean,
    minStorageBalance: bigint
  ): Transaction[] {
    return [
      {
        receiverId: assetAccountId,
        actions: [
          ...(isStorageDepositRequired
            ? [
                {
                  type: "FunctionCall" as const,
                  params: {
                    methodName: "storage_deposit",
                    args: {
                      account_id: settings.defuseContractId,
                      registration_only: true,
                    },
                    gas: FT_DEPOSIT_GAS,
                    deposit: minStorageBalance.toString(),
                  },
                },
              ]
            : []),
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: {
                receiver_id: settings.defuseContractId,
                amount: amount.toString(),
                msg: "",
              },
              gas: FT_TRANSFER_GAS,
              deposit: "1",
            },
          },
        ],
      },
    ]
  }

  createBatchDepositNearNativeTransaction(
    assetAccountId: string,
    amount: bigint,
    wrapAmount: bigint,
    isWrapNearRequired: boolean,
    minStorageBalance: bigint
  ): Transaction[] {
    return [
      {
        receiverId: assetAccountId,
        actions: [
          ...(isWrapNearRequired
            ? [
                {
                  type: "FunctionCall" as const,
                  params: {
                    methodName: "near_deposit",
                    args: {},
                    gas: FT_DEPOSIT_GAS,
                    deposit: (wrapAmount + minStorageBalance).toString(),
                  },
                },
              ]
            : []),
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: {
                receiver_id: settings.defuseContractId,
                amount: amount.toString(),
                msg: "",
              },
              gas: FT_TRANSFER_GAS,
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
   * @param userAddress - The user address from the wallet
   * @param chain - The blockchain for which to generate the address
   * @returns A Promise that resolves to the generated deposit address
   */
  async generateDepositAddress(
    userAddress: DefuseUserId,
    chain: BlockchainEnum
  ): Promise<string> {
    try {
      const supportedTokens = await getSupportedTokens({
        chains: [chain],
      })

      if (supportedTokens.tokens.length === 0) {
        throw new Error("No supported tokens found")
      }

      const generatedDepositAddress = await getDepositAddress({
        account_id: userAddress,
        chain,
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

  async isStorageDepositRequired(
    contractId: string,
    accountId: string
  ): Promise<boolean> {
    // Aurora is a special case and does not require storage deposit
    if (contractId === "aurora") {
      return false
    }
    const storageBalance = await getNearNep141StorageBalance({
      contractId,
      accountId,
    })
    return storageBalance < (await this.getMinimumStorageBalance(contractId))
  }

  async getMinimumStorageBalance(contractId: string): Promise<bigint> {
    return getNearNep141MinStorageBalance({
      contractId,
    })
  }
}
