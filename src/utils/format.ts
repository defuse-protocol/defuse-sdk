export function formatTokenValue(
  num: bigint | string | number,
  decimals: number,
  {
    min,
    fractionDigits = decimals,
  }: {
    min?: number
    fractionDigits?: number
  } = {}
): string {
  const numBigInt = BigInt(num)
  if (numBigInt === 0n) {
    return "0"
  }

  fractionDigits = Math.min(fractionDigits, decimals)

  const exp = 10n ** BigInt(decimals)
  const fraction = numBigInt % exp
  const integer = numBigInt / exp

  const roundedFraction =
    fraction / 10n ** BigInt(Math.max(decimals - fractionDigits, 0))

  const formatted =
    roundedFraction === 0n
      ? `${integer}`
      : `${integer}.${toFixed(roundedFraction.toString(), fractionDigits)}`

  if (min != null && Number(formatted) < min) {
    return `< ${min}`
  }

  return formatted
}

function toFixed(number: string, digits: number) {
  return trimEnd(number.padStart(digits, "0"), "0")
}

function trimEnd(s: string, char: string) {
  let pointer: number | undefined

  for (let i = s.length - 1; 0 <= i; i--) {
    if (s[i] === char) {
      pointer = i
    } else {
      break
    }
  }

  return pointer != null ? s.slice(0, pointer) : s
}
