import {
  LAMPORTS_PER_SOL,
  PublicKey as PublicKeySolana,
  SystemProgram,
  Transaction as TransactionSolana,
} from "@solana/web3.js"
import {
  type Address,
  type Hash,
  encodeFunctionData,
  erc20Abi,
  getAddress,
} from "viem"
import { settings } from "../config/settings"
import {
  getNearNep141MinStorageBalance,
  getNearNep141StorageBalance,
} from "../features/machines/getBalanceMachine"
import { getNearTxSuccessValue } from "../features/machines/getTxMachine"
import { BlockchainEnum } from "../types"
import { ChainType } from "../types"
import type { Transaction } from "../types/deposit"
import { type DefuseUserId, userAddressToDefuseUserId } from "../utils/defuse"
import { getDepositAddress, getSupportedTokens } from "./poaBridgeClient"

const FT_DEPOSIT_GAS = `30${"0".repeat(12)}` // 30 TGAS
const FT_TRANSFER_GAS = `50${"0".repeat(12)}` // 30 TGAS

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
export function createBatchDepositNearNep141Transaction(
  assetAccountId: string,
  amount: bigint,
  isStorageDepositRequired: boolean,
  minStorageBalance: bigint
): Transaction["NEAR"][] {
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

export function createBatchDepositNearNativeTransaction(
  assetAccountId: string,
  amount: bigint,
  wrapAmount: bigint,
  isWrapNearRequired: boolean,
  minStorageBalance: bigint
): Transaction["NEAR"][] {
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

export function createDepositEVMERC20Transaction(
  assetAccountId: string,
  generatedAddress: string,
  amount: bigint
): { to: Address; data: Hash } {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [generatedAddress as Address, amount],
  })
  return {
    to: assetAccountId as Address,
    data,
  }
}

export function createDepositFromSiloTransaction(
  tokenAddress: string,
  userAddress: string,
  amount: bigint,
  depositAddress: string,
  siloAddress: string,
  chainType: ChainType
): { to: Address; data: Hash } {
  const data = encodeFunctionData({
    abi: siloToSiloABI,
    functionName: "safeFtTransferCallToNear",
    args: [
      getAddress(tokenAddress),
      amount,
      depositAddress,
      userAddressToDefuseUserId(userAddress, ChainType.EVM),
    ],
  })
  return {
    to: siloAddress as Address,
    data,
  }
}

export function createDepositEVMNativeTransaction(
  generatedAddress: string,
  amount: bigint
): { to: Address; value: bigint; data: Hash } {
  return {
    to: generatedAddress as Address,
    value: amount,
    data: "0x",
  }
}

export function createDepositSolanaTransaction(
  from: string,
  to: string,
  amount: bigint
): TransactionSolana {
  const transaction = new TransactionSolana().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKeySolana(from),
      toPubkey: new PublicKeySolana(to),
      lamports: amount,
    })
  )
  return transaction
}

/**
 * Generate a deposit address for the specified blockchain and asset through the POA bridge API call.
 *
 * @param userAddress - The user address from the wallet
 * @param chain - The blockchain for which to generate the address
 * @returns A Promise that resolves to the generated deposit address
 */
export async function generateDepositAddress(
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

export async function checkNearTransactionValidity(
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

export async function isStorageDepositRequired(
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
  return storageBalance < (await getMinimumStorageBalance(contractId))
}

export async function getMinimumStorageBalance(
  contractId: string
): Promise<bigint> {
  return getNearNep141MinStorageBalance({
    contractId,
  })
}

/**
 * Get the available deposit routes for a given wallet connection and selected network.
 *
 * @param chainTypeFromWallet - The type of chain from wallet connection [near, evm].
 * @param network - The network to check.
 * @returns An object containing the available deposit routes.
 *
 * @remarks
 * - `activeDeposit` is deposit via wallet extension.
 * - `passiveDeposit` is deposit via generated address at QR code provided by POA bridge.
 */
export function getAvailableDepositRoutes(
  chainTypeFromWallet: ChainType,
  network: BlockchainEnum
): { activeDeposit: boolean; passiveDeposit: boolean } | null {
  switch (chainTypeFromWallet) {
    case ChainType.Near:
      switch (network) {
        case BlockchainEnum.NEAR:
          return {
            activeDeposit: true,
            passiveDeposit: false,
          }
        case BlockchainEnum.ETHEREUM:
        case BlockchainEnum.BASE:
        case BlockchainEnum.ARBITRUM:
        case BlockchainEnum.BITCOIN:
        case BlockchainEnum.SOLANA:
        case BlockchainEnum.DOGECOIN:
          return {
            activeDeposit: false,
            passiveDeposit: true,
          }
        case BlockchainEnum.TURBOCHAIN:
          return {
            activeDeposit: false,
            passiveDeposit: false,
          }
        default:
          network satisfies never
          throw new Error("exhaustive check failed")
      }
    case ChainType.EVM:
      switch (network) {
        case BlockchainEnum.NEAR:
          return {
            activeDeposit: false,
            passiveDeposit: false,
          }
        case BlockchainEnum.TURBOCHAIN:
          return {
            activeDeposit: true,
            passiveDeposit: false,
          }
        case BlockchainEnum.ETHEREUM:
        case BlockchainEnum.BASE:
        case BlockchainEnum.ARBITRUM:
          return {
            activeDeposit: true,
            passiveDeposit: true,
          }
        case BlockchainEnum.BITCOIN:
        case BlockchainEnum.SOLANA:
        case BlockchainEnum.DOGECOIN:
          return {
            activeDeposit: false,
            passiveDeposit: true,
          }
        default:
          network satisfies never
          throw new Error("exhaustive check failed")
      }
    case ChainType.Solana:
      switch (network) {
        case BlockchainEnum.NEAR:
        case BlockchainEnum.TURBOCHAIN:
          return {
            activeDeposit: false,
            passiveDeposit: false,
          }
        case BlockchainEnum.ETHEREUM:
        case BlockchainEnum.BASE:
        case BlockchainEnum.ARBITRUM:
        case BlockchainEnum.BITCOIN:
        case BlockchainEnum.DOGECOIN:
          return {
            activeDeposit: false,
            passiveDeposit: true,
          }
        case BlockchainEnum.SOLANA:
          return {
            activeDeposit: true,
            passiveDeposit: true,
          }
        default:
          network satisfies never
          throw new Error("exhaustive check failed")
      }
    default:
      chainTypeFromWallet satisfies never
      throw new Error("exhaustive check failed")
  }
}

// Use this function to get strong typing for RPC URLs
export function getWalletRpcUrl(network: BlockchainEnum): string {
  switch (network) {
    case BlockchainEnum.NEAR:
      return settings.rpcUrls.near
    case BlockchainEnum.ETHEREUM:
      return settings.rpcUrls.eth
    case BlockchainEnum.BASE:
      return settings.rpcUrls.base
    case BlockchainEnum.ARBITRUM:
      return settings.rpcUrls.arbitrum
    case BlockchainEnum.BITCOIN:
      return settings.rpcUrls.bitcoin
    case BlockchainEnum.SOLANA:
      return settings.rpcUrls.solana
    case BlockchainEnum.DOGECOIN:
      return settings.rpcUrls.dogecoin
    case BlockchainEnum.TURBOCHAIN:
      return settings.rpcUrls.turbochain
    default:
      network satisfies never
      throw new Error("exhaustive check failed")
  }
}

const siloToSiloABI = [
  {
    inputs: [
      {
        internalType: "contract IEvmErc20",
        name: "token",
        type: "address",
      },
      {
        internalType: "uint128",
        name: "amount",
        type: "uint128",
      },
      {
        internalType: "string",
        name: "receiverId",
        type: "string",
      },
      {
        internalType: "string",
        name: "message",
        type: "string",
      },
    ],
    name: "safeFtTransferCallToNear",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
]
