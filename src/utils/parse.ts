import { parseUnits as parseUnitsViem } from "viem"

export function parseUnits(val: string, decimals: number): bigint {
  const normVal = val.replaceAll(",", ".")
  return parseUnitsViem(normVal, decimals)
}
