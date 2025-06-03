export type { RequestErrorType } from "../../utils/request"

export type RequestConfig = {
  timeout?: number | undefined
  fetchOptions?: Omit<RequestInit, "body"> | undefined
}

export type GeneratHLAddressResponse = {
  address: string
  signatures: {
    "field-node": string
    "hl-node": string
    "node-1": string
  }
  status: "OK"
}

export type GeneratHLAddressParams = {
  srcChain: "bitcoin" | "solana" | "ethereum"
  dstChain: "bitcoin" | "solana" | "ethereum"
  asset: "btc" | "eth" | "sol"
  dstAddr: string
}
