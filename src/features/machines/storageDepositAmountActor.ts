import type { BaseTokenInfo } from "src/types"
import { fromPromise } from "xstate"
import { getNEP141StorageRequired } from "../../services/nep141StorageService"

export const storageDepositAmountActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      token: BaseTokenInfo
      userAccountId: string
    }
  }): Promise<bigint | null> => {
    try {
      const result = await getNEP141StorageRequired({
        token: input.token,
        userAccountId: input.userAccountId,
      })
      if (result.tag === "ok") {
        return result.value
      }
      return null
    } catch (error) {
      throw new Error("ERR_NEP141_STORAGE_CANNOT_FETCH")
    }
  }
)