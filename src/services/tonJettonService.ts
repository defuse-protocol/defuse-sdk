import { Address, type TonClient, beginCell } from "@ton/ton"

export interface JettonInfo {
  address: string
  decimals: number
}

export interface JettonWalletData {
  balance: bigint
  ownerAddress: Address
  adminAddress: Address | null
}

export async function getUserJettonWalletAddress(
  client: TonClient,
  userWalletAddress: string,
  jettonMasterAddress: string
): Promise<string> {
  const userTonAddress = Address.parse(userWalletAddress)
  const userAddressCell = beginCell().storeAddress(userTonAddress).endCell()

  const getWalletAddressResult = await client.runMethod(
    Address.parse(jettonMasterAddress),
    "get_wallet_address",
    [{ type: "slice", cell: userAddressCell }]
  )
  const jettonWalletAddress = getWalletAddressResult.stack.readAddress()

  if (!jettonWalletAddress) {
    throw new Error("Jetton wallet address not found")
  }

  return jettonWalletAddress.toString()
}

export async function getJettonWalletData(
  client: TonClient,
  jettonWalletAddress: string
): Promise<JettonWalletData> {
  const walletDataResult = await client.runMethod(
    Address.parse(jettonWalletAddress),
    "get_wallet_data"
  )

  const balance = walletDataResult.stack.readBigNumber()
  const ownerAddress = walletDataResult.stack.readAddress()
  const adminAddress = walletDataResult.stack.readAddressOpt()

  return {
    balance,
    ownerAddress,
    adminAddress,
  }
}

export async function checkJettonWalletExists(
  client: TonClient,
  jettonWalletAddress: Address
): Promise<boolean> {
  try {
    await client.runMethod(jettonWalletAddress, "get_wallet_data")
    return true
  } catch {
    return false
  }
}
