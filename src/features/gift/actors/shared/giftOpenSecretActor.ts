import { fromPromise } from "xstate"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import { getGiftInfo } from "../../utils/getGiftInfo"

export const giftOpenSecretActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      secretKey: string
      tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
    }
  }) => {
    const giftInfoResult = await getGiftInfo(input.secretKey, input.tokenList)

    if (giftInfoResult.isErr()) {
      return {
        tag: "err",
        value: {
          reason: giftInfoResult.unwrapErr(),
        },
      }
    }
    return {
      tag: "ok",
      value: {
        giftInfo: giftInfoResult.unwrap(),
      },
    }
  }
)
