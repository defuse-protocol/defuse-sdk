import { http, type Address, type Hash, createPublicClient } from "viem"

// Function returns the gas cost in Wei for a transfer
export async function estimateEVMTransferCost({
  rpcUrl,
  from,
  to,
  data,
  value,
}: {
  rpcUrl: string
  from: Address
  to: Address
  data?: Hash
  value?: bigint
}): Promise<bigint> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  })
  const gasLimit = await client.estimateGas({
    account: from,
    to,
    data: data ?? "0x",
    value: value ?? 0n,
  })
  const gasPrice = await client.getGasPrice()
  // Add 15% buffer to gas cost estimation to account for potential price fluctuations
  const costInWei = (gasPrice * gasLimit * 115n) / 100n
  return costInWei
}
