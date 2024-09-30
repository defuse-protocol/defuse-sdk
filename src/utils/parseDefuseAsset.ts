export type ParseDefuseAssetResult = {
  blockchain: string
  network: string
  contractId: string
} | null

export const parseDefuseAsset = (
  defuseAssetId: string
): ParseDefuseAssetResult => {
  try {
    const [blockchain, network, contractId] = defuseAssetId.split(":")
    return {
      blockchain: blockchain as string,
      network: network as string,
      contractId: contractId as string,
    }
  } catch (e) {
    console.error("Failed to parse defuse asset id", e)
    return null
  }
}
