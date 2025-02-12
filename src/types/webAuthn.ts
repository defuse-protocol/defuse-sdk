export type CurveType = "p256" | "ed25519"

export type FormattedPublicKey = `${CurveType}:${string}`

export type CredentialKey = {
  curveType: CurveType
  publicKey: Uint8Array
}
