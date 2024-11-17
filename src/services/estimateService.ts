import type { RpcUrl } from "src/utils/defuse"
import { http, type Address, type Hash, createPublicClient } from "viem"

// Function returns the gas cost in Wei for a transfer
export async function estimateEVMEtnTransferCost({
  rpcUrl,
  from,
  to,
  value,
}: {
  rpcUrl: RpcUrl
  from: Address
  to: Address
  value: bigint
}): Promise<bigint> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  })
  const gasLimit = await client.estimateGas({
    account: from,
    to,
    value,
  })
  const gasPrice = await client.getGasPrice()
  // Add 15% buffer to gas cost estimation to account for potential price fluctuations
  const costInWei = (gasPrice * gasLimit * 115n) / 100n
  return costInWei
}

// Function returns the gas cost in Wei for a transfer
export async function estimateEVMErc20TransferCost({
  rpcUrl,
  to,
  from,
  data,
}: {
  rpcUrl: RpcUrl
  from: Address
  to: Address
  data: Hash
}): Promise<bigint> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  })
  const gasLimit = await client.estimateGas({
    account: from,
    to,
    data,
  })
  const gasPrice = await client.getGasPrice()
  // Add 15% buffer to gas cost estimation to account for potential price fluctuations
  const costInWei = (gasPrice * gasLimit * 115n) / 100n
  return costInWei
}
