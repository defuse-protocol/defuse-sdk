import { parseUnits } from "ethers"
import * as borsh from "borsh"
import Ajv from "ajv"

import {
  CONTRACTS_REGISTER,
  CREATE_INTENT_EXPIRATION_BLOCK_BOOST,
  CREATE_INTENT_ROLLBACK_DELAY,
  LIST_NATIVE_TOKENS,
  MAX_GAS_TRANSACTION,
} from "src/constants"
import {
  ContractIdEnum,
  INDEXER,
  NearIntent1CreateCrossChain,
  NearIntent1CreateSingleChain,
  TransactionMethod,
} from "src/types"

import { MapCreateIntentProps } from "./maps"
import { swapSchema } from "./schema"
import parseDefuseAsset from "./parseDefuseAsset"
import {
  msgSchemaCreateIntent1CrossChain,
  msgSchemaCreateIntent1SingleChain,
} from "./jsonValidations"

const REFERRAL_ACCOUNT = process.env.REFERRAL_ACCOUNT ?? ""

export const prepareCreateIntent0 = (inputs: MapCreateIntentProps) => {
  const isNativeTokenIn = inputs.selectedTokenIn.address === "native"
  const tokenNearNative = LIST_NATIVE_TOKENS.find(
    (token) => token.defuseAssetId === "near:mainnet:native"
  )
  const receiverIdIn = isNativeTokenIn
    ? tokenNearNative!.routes
      ? tokenNearNative!.routes[0]
      : ""
    : inputs.selectedTokenIn.address

  const unitsSendAmount = parseUnits(
    inputs.tokenIn,
    inputs.selectedTokenIn.decimals as number
  ).toString()
  const estimateUnitsBackAmount = parseUnits(
    inputs.tokenOut,
    inputs.selectedTokenOut.decimals as number
  ).toString()

  const msg = {
    CreateIntent: {
      id: inputs.intentId,
      IntentStruct: {
        initiator: inputs.accountId,
        send: {
          token_id:
            inputs.selectedTokenIn.address === "native"
              ? "wrap.near"
              : inputs.selectedTokenIn.address,
          amount: unitsSendAmount,
        },
        receive: {
          token_id:
            inputs.selectedTokenOut.address === "native"
              ? "wrap.near"
              : inputs.selectedTokenOut.address,
          amount: estimateUnitsBackAmount,
        },
        expiration: {
          Block: inputs.blockHeight + CREATE_INTENT_EXPIRATION_BLOCK_BOOST,
        },
        referral: {
          Some: REFERRAL_ACCOUNT,
        },
      },
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgBorsh = borsh.serialize(swapSchema as any, msg)

  return {
    receiverId: receiverIdIn,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: TransactionMethod.FT_TRANSFER_CALL,
          args: {
            receiver_id: CONTRACTS_REGISTER[INDEXER.INTENT_0],
            amount: unitsSendAmount,
            memo: "Execute intent: NEP-141 to NEP-141",
            msg: Buffer.from(msgBorsh).toString("base64"),
          },
          gas: MAX_GAS_TRANSACTION,
          deposit: "1",
        },
      },
    ],
  }
}

export const prepareCreateIntent1CrossChain = (
  inputs: MapCreateIntentProps
) => {
  const receiverIdIn = inputs.selectedTokenIn.address
  const unitsSendAmount = inputs.tokenIn
  const estimateUnitsBackAmount = inputs.tokenOut

  const from = parseDefuseAsset(inputs.selectedTokenIn.defuseAssetId)
  const contractIdTokenIn = from?.contractId ?? ""

  const msg: NearIntent1CreateCrossChain = {
    type: "create",
    id: inputs.intentId as string,
    asset_out: {
      type: "cross_chain",
      oracle: inputs.solverId as string,
      asset: inputs.selectedTokenOut.defuseAssetId,
      amount: estimateUnitsBackAmount,
      account: inputs.accountTo as string,
    },
    lockup_until: {
      block_number: inputs.blockHeight + CREATE_INTENT_ROLLBACK_DELAY,
    },
    expiration: {
      block_number: inputs.blockHeight + CREATE_INTENT_EXPIRATION_BLOCK_BOOST,
    },
    referral: REFERRAL_ACCOUNT,
  }

  const ajv = new Ajv()
  const validate = ajv.compile(msgSchemaCreateIntent1CrossChain)
  const isValid = validate(msg)
  if (!isValid) {
    console.log("Validation errors:", validate.errors)
    throw new Error(`Validation schema errors`)
  }

  const params = {}
  if (contractIdTokenIn === ContractIdEnum.Native) {
    Object.assign(params, {
      methodName: TransactionMethod.NATIVE_ON_TRANSFER,
      args: {
        msg: JSON.stringify(msg),
      },
      gas: MAX_GAS_TRANSACTION,
      deposit: unitsSendAmount,
    })
  } else {
    Object.assign(params, {
      methodName: TransactionMethod.FT_TRANSFER_CALL,
      args: {
        receiver_id: CONTRACTS_REGISTER[INDEXER.INTENT_1],
        amount: unitsSendAmount,
        memo: `Execute intent: ${inputs.selectedTokenIn.defuseAssetId} to ${inputs.selectedTokenOut.defuseAssetId}`,
        msg: JSON.stringify(msg),
      },
      gas: MAX_GAS_TRANSACTION,
      deposit: "1",
    })
  }

  return {
    receiverId:
      contractIdTokenIn === ContractIdEnum.Native
        ? CONTRACTS_REGISTER[INDEXER.INTENT_1]
        : receiverIdIn,
    actions: [
      {
        type: "FunctionCall",
        params,
      },
    ],
  }
}

export const prepareCreateIntent1SingleChain = (
  inputs: MapCreateIntentProps
) => {
  const receiverIdIn = inputs.selectedTokenIn.address
  const unitsSendAmount = inputs.tokenIn
  const estimateUnitsBackAmount = inputs.tokenOut

  const from = parseDefuseAsset(inputs.selectedTokenIn.defuseAssetId)
  const contractIdTokenIn = from?.contractId ?? ""
  const to = parseDefuseAsset(inputs.selectedTokenOut.defuseAssetId)
  const contractIdTokenOut = to?.contractId ?? ""

  const msg: NearIntent1CreateSingleChain = {
    type: "create",
    id: inputs.intentId as string,
    asset_out: {
      type: contractIdTokenOut === ContractIdEnum.Native ? "native" : "nep141",
      token: contractIdTokenOut as string,
      amount: estimateUnitsBackAmount as string,
      account: inputs.accountTo
        ? (inputs.accountTo as string)
        : (inputs.accountId as string),
    },
    lockup_until: {
      block_number: inputs.blockHeight + CREATE_INTENT_ROLLBACK_DELAY,
    },
    expiration: {
      block_number: inputs.blockHeight + CREATE_INTENT_EXPIRATION_BLOCK_BOOST,
    },
    referral: REFERRAL_ACCOUNT,
  }

  const ajv = new Ajv()
  const validate = ajv.compile(msgSchemaCreateIntent1SingleChain)
  const isValid = validate(msg)
  if (!isValid) {
    console.log("Validation errors:", validate.errors)
    throw new Error(`Validation schema errors`)
  }

  const params = {}
  if (contractIdTokenIn === ContractIdEnum.Native) {
    Object.assign(params, {
      methodName: TransactionMethod.NATIVE_ON_TRANSFER,
      args: {
        msg: JSON.stringify(msg),
      },
      gas: MAX_GAS_TRANSACTION,
      deposit: unitsSendAmount,
    })
  } else {
    Object.assign(params, {
      methodName: TransactionMethod.FT_TRANSFER_CALL,
      args: {
        receiver_id: CONTRACTS_REGISTER[INDEXER.INTENT_1],
        amount: unitsSendAmount,
        memo: "Execute intent: NEP-141 to NEP-141",
        msg: JSON.stringify(msg),
      },
      gas: MAX_GAS_TRANSACTION,
      deposit: "1",
    })
  }

  return {
    receiverId:
      contractIdTokenIn === ContractIdEnum.Native
        ? CONTRACTS_REGISTER[INDEXER.INTENT_1]
        : receiverIdIn,
    actions: [
      {
        type: "FunctionCall",
        params,
      },
    ],
  }
}
