import { fromPromise } from "xstate"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import { determineGiftToken } from "../../utils/determineGiftToken"
import { parseEscrowCredentials } from "../../utils/generateEscrowCredentials"
import { parseGiftSecret } from "../../utils/parseGiftSecret"

export type GiftOpenSecretActorInput = {
  secretKey: string
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
}

export type GiftOpenSecretActorOutput =
  | {
      tag: "ok"
      value: {
        giftInfo: GiftInfo
      }
    }
  | {
      tag: "err"
      value: GiftInfoErr
    }

export type GiftInfo = {
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  token: BaseTokenInfo | UnifiedTokenInfo
  secretKey: string
  accountId: string
}

export type GiftInfoErr = {
  reason: "INVALID_SECRET_KEY" | "NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED"
}

export const getGiftInfo = fromPromise(
  async ({
    input,
  }: {
    input: GiftOpenSecretActorInput
  }): Promise<GiftOpenSecretActorOutput> => {
    const parseResult = parseGiftSecret(input.secretKey)
    if (parseResult.isErr()) {
      return {
        tag: "err",
        value: { reason: "INVALID_SECRET_KEY" },
      }
    }

    const escrowCredentials = parseEscrowCredentials(
      parseResult.unwrap().secretKey
    )
    const determineResult = await determineGiftToken(
      input.tokenList,
      escrowCredentials
    )
    if (determineResult.isErr()) {
      return {
        tag: "err",
        value: { reason: "NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED" },
      }
    }

    return {
      tag: "ok",
      value: {
        giftInfo: {
          tokenDiff: determineResult.unwrap().tokenDiff,
          token: determineResult.unwrap().token,
          secretKey: parseResult.unwrap().secretKey,
          accountId: escrowCredentials.credential,
        },
      },
    }
  }
)
