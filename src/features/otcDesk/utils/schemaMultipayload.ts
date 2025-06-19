import { z } from "zod"
import { IntentSchema } from "./schemaIntents"
import {
  DeadlineSchema,
  NearAccountIdSchema,
  NonceSchema,
  PublicKeyED25519Schema,
  PublicKeyP256Schema,
  SignatureED25519Schema,
  SignatureP256Schema,
  SignatureSecp256k1Schema,
  WebAuthnAuthenticatorData,
  WebAuthnClientDataJson,
} from "./schemaPrimitives"

export const GeneralPayloadObjectSchema = z.object({
  deadline: DeadlineSchema,
  nonce: NonceSchema,
  signer_id: NearAccountIdSchema,
  verifying_contract: NearAccountIdSchema,
  intents: z.array(IntentSchema),
})

export const GeneralPayloadStringSchema = z
  .string()
  .transform((a) => {
    try {
      return JSON.parse(a)
    } catch {
      return null
    }
  })
  .pipe(GeneralPayloadObjectSchema)

const NEP413PayloadObjectSchema = z.object({
  deadline: DeadlineSchema,
  signer_id: NearAccountIdSchema,
  intents: z.array(IntentSchema),
})

const NEP413PayloadStringSchema = z
  .string()
  .transform((a) => {
    try {
      return JSON.parse(a)
    } catch {
      return null
    }
  })
  .pipe(NEP413PayloadObjectSchema)

export const PayloadStringSchema = z.union([
  GeneralPayloadStringSchema,
  NEP413PayloadStringSchema,
])

const WebAuthnP256Schema = z.object({
  standard: z.literal("webauthn"),
  curveType: z.literal("p256"),
  payload: z.string(),
  signature: SignatureP256Schema,
  public_key: PublicKeyP256Schema,
  authenticator_data: WebAuthnAuthenticatorData,
  client_data_json: WebAuthnClientDataJson,
})

const WebAuthnED25519Schema = z.object({
  standard: z.literal("webauthn"),
  curveType: z.literal("ed25519"),
  payload: z.string(),
  signature: SignatureED25519Schema,
  public_key: PublicKeyED25519Schema,
  authenticator_data: WebAuthnAuthenticatorData,
  client_data_json: WebAuthnClientDataJson,
})

const WebAuthnSchema = z
  .object({
    standard: z.literal("webauthn"),
    public_key: z.string(),
  })
  .transform((a) => {
    const curveType = a.public_key.split(":")[0]
    if (curveType === "p256") {
      return { ...a, curveType: "p256" } as const
    }
    if (curveType === "ed25519") {
      return { ...a, curveType: "ed25519" } as const
    }
    throw new Error("Invalid curve type")
  })
  .pipe(z.union([WebAuthnP256Schema, WebAuthnED25519Schema]))

export const MultiPayloadSchema = z.union([
  z.object({
    standard: z.literal("nep413"),
    payload: z.object({
      message: z.string(),
      nonce: NonceSchema,
      recipient: NearAccountIdSchema,
      callbackUrl: z.string().optional(),
    }),
    signature: SignatureED25519Schema,
    public_key: PublicKeyED25519Schema,
  }),
  z.object({
    standard: z.literal("erc191"),
    payload: z.string(),
    signature: SignatureSecp256k1Schema,
  }),
  z.object({
    standard: z.literal("raw_ed25519"),
    payload: z.string(),
    signature: SignatureED25519Schema,
    public_key: PublicKeyED25519Schema,
  }),
  WebAuthnSchema,
])

export type MultiPayloadSchemaOutput = z.infer<typeof MultiPayloadSchema>

const WebAuthnDeepP256Schema = z.object({
  standard: z.literal("webauthn"),
  curveType: z.literal("p256"),
  payload: GeneralPayloadStringSchema,
  signature: SignatureP256Schema,
  public_key: PublicKeyP256Schema,
  authenticator_data: WebAuthnAuthenticatorData,
  client_data_json: WebAuthnClientDataJson,
})

const WebAuthnDeepED25519Schema = z.object({
  standard: z.literal("webauthn"),
  curveType: z.literal("ed25519"),
  payload: GeneralPayloadStringSchema,
  signature: SignatureED25519Schema,
  public_key: PublicKeyED25519Schema,
  authenticator_data: WebAuthnAuthenticatorData,
  client_data_json: WebAuthnClientDataJson,
})

const WebAuthnDeepSchema = z
  .object({
    standard: z.literal("webauthn"),
    public_key: z.string(),
  })
  .transform((a) => {
    const curveType = a.public_key.split(":")[0]
    if (curveType === "p256") {
      return { ...a, curveType: "p256" } as const
    }
    if (curveType === "ed25519") {
      return { ...a, curveType: "ed25519" } as const
    }
    throw new Error("Invalid curve type")
  })
  .pipe(z.union([WebAuthnDeepP256Schema, WebAuthnDeepED25519Schema]))

export const MultiPayloadDeepSchema = z.union([
  z.object({
    standard: z.literal("nep413"),
    payload: z.object({
      message: NEP413PayloadStringSchema,
      nonce: NonceSchema,
      recipient: NearAccountIdSchema,
      callbackUrl: z.string().optional(),
    }),
    signature: SignatureED25519Schema,
    public_key: PublicKeyED25519Schema,
  }),
  z.object({
    standard: z.literal("erc191"),
    payload: GeneralPayloadStringSchema,
    signature: SignatureSecp256k1Schema,
  }),
  z.object({
    standard: z.literal("raw_ed25519"),
    payload: GeneralPayloadStringSchema,
    signature: SignatureED25519Schema,
    public_key: PublicKeyED25519Schema,
  }),
  WebAuthnDeepSchema,
])

export const MultiPayloadPlainSchema = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .transform((a) => {
    try {
      return typeof a === "string" ? JSON.parse(a) : a
    } catch {
      return null
    }
  })
  .pipe(MultiPayloadSchema)
