import { parseDefuseAsset } from "./parseDefuseAsset"

export const isForeignChainSwap = (
  defuseTokenIdIn: string,
  defuseTokenIdOut: string
) => {
  return (
    parseDefuseAsset(defuseTokenIdIn)?.blockchain !== "near" ||
    parseDefuseAsset(defuseTokenIdOut)?.blockchain !== "near"
  )
}
