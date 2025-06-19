import { z } from "zod"

export type ExpiryFormatted = `${number}{"m" | "h" | "d"}`

export type Expiry = z.infer<typeof ExpiryScheme>

const ExpiryScheme = z
  .string()
  .transform((a) => parseExpiryString(a))
  .pipe(
    z.object({
      unit: z.enum(["m", "h", "d"]),
      value: z.number(),
    })
  )

export function parseExpiry(str: string): Expiry | null {
  const a = ExpiryScheme.safeParse(str)
  return a.success ? a.data : null
}

function parseExpiryString(expiry: string) {
  const regexp = /^(\d+)([mhd])$/
  const match = expiry.match(regexp)

  if (!match) return null

  const [, value, unit] = match
  if (value === undefined || unit === undefined) return null

  return {
    unit: unit,
    value: Number.parseInt(value),
  }
}

export function expiryToSeconds(expiry: Expiry): number {
  const { unit, value } = expiry
  switch (unit) {
    case "m":
      return value * 60
    case "h":
      return value * 60 * 60
    case "d":
      return value * 60 * 60 * 24
    default:
      unit satisfies never
      return 0
  }
}
