import { assert } from "src/utils/assert"
import { fromPromise } from "xstate"
import { getNEP141StorageRequired } from "../../services/nep141StorageService"
import type { BaseTokenInfo } from "../../types/base"

export const storageDepositAmountActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      token: BaseTokenInfo
      userAccountId: string
    }
  }): Promise<bigint> => {
    const result = await getNEP141StorageRequired({
      token: input.token,
      userAccountId: input.userAccountId,
    })
    assert(result.tag === "ok", "ERR_NEP141_STORAGE_CANNOT_FETCH")
    return result.value
  }
)
