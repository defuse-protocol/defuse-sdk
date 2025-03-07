import { base64 } from "@scure/base"
import * as v from "valibot"
import { isLegitAccountId } from "../../../utils/near"

export const ToBigIntSchema = v.pipe(
  v.string(),
  v.transform((a) => BigInt(a))
)

export const NearAccountIdSchema = v.pipe(v.string(), v.check(isLegitAccountId))

export const DeadlineSchema = v.pipe(v.string(), v.isoTimestamp())

export const NonceSchema = v.pipe(
  v.string(),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed) {
      try {
        const bytes = base64.decode(dataset.value)
        if (bytes.length !== 32) {
          addIssue({
            message: "Invalid length (32 bytes expected)",
          })
        }
      } catch {
        addIssue({
          message: "Invalid base64 encoding",
        })
      }
    }
  })
)
