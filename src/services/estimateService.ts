import type { RpcUrl } from "src/utils/defuse"
import { http, type Address, type Hash, createPublicClient } from "viem"

export async function estimateEthTransferCost({
  rpcUrl,
  to,
  data,
}: {
  rpcUrl: RpcUrl
  to: Address
  data: Hash
}): Promise<bigint> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  })
  const gas = await client.estimateGas({
    to,
    data,
  })
  const gasPrice = await client.getGasPrice()
  const gasLimit = 21000n
  const costInWei = gasPrice * gasLimit
  return costInWei
}
