import { base58, base64 } from "@scure/base"
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

export const TokenIdSchema = v.pipe(
  v.string(),
  v.startsWith("nep141:"),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed) {
      const key = dataset.value.split(":")[1] ?? ""
      if (!isLegitAccountId(key)) {
        addIssue({ message: "Invalid NEP-141 token account ID" })
      }
    }
  })
)

export const PublicKeyED25519Schema = v.pipe(
  v.string(),
  v.startsWith("ed25519:"),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed) {
      const key = dataset.value.split(":")[1] ?? ""
      try {
        const bytes = base58.decode(key)
        if (bytes.length !== 32) {
          addIssue({ message: "Invalid length (32 bytes expected)" })
        }
      } catch {
        addIssue({ message: "Invalid base58 encoding" })
      }
    }
  })
)

export const SignatureED25519Schema = v.pipe(
  v.string(),
  v.startsWith("ed25519:"),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed) {
      const key = dataset.value.split(":")[1] ?? ""
      try {
        const bytes = base58.decode(key)
        if (bytes.length !== 64) {
          addIssue({ message: "Invalid length (64 bytes expected)" })
        }
      } catch {
        addIssue({ message: "Invalid base58 encoding" })
      }
    }
  })
)

export const SignatureSecp256k1Schema = v.pipe(
  v.string(),
  v.startsWith("secp256k1:"),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed) {
      const key = dataset.value.split(":")[1] ?? ""
      try {
        const bytes = base58.decode(key)
        if (bytes.length !== 65) {
          addIssue({ message: "Invalid length (65 bytes expected)" })
        }
      } catch {
        addIssue({ message: "Invalid base58 encoding" })
      }
    }
  })
)
