import axios, { AxiosRequestConfig } from "axios"

import {
  DataEstimateRequest,
  SolverEstimateProviderResponse,
} from "../../types"

export const REGISTRAR_ID_COINGECKO = "coingecko"

const coingeckoApiKey = process?.env?.COINGECKO_API_KEY ?? ""
const appOriginUrl = process.env.ORIGIN_URL ?? "*"

const getExchangesList = () => {
  const config: AxiosRequestConfig = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": appOriginUrl,
      "x-cg-pro-api-key": coingeckoApiKey,
    },
  }
  const id = "coinbase"
  return axios
    .get(`https://pro-api.coingecko.com/api/v3/exchanges/list`, config)
    .then((resp) => resp.data)
}

export const getTrendingList = (id = "binance") => {
  const config: AxiosRequestConfig = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": appOriginUrl,
      "x-cg-pro-api-key": coingeckoApiKey,
    },
  }
  return axios
    .get(`https://pro-api.coingecko.com/api/v3/exchanges/${id}/tickers`, config)
    .then((resp) => resp.data)
}

export const getCoinsListWithMarketData = (currency = "usd") => {
  const config: AxiosRequestConfig = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": appOriginUrl,
      "x-cg-pro-api-key": coingeckoApiKey,
    },
  }
  return axios
    .get(
      `https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}`,
      config
    )
    .then((resp) => resp.data)
}

export const swapEstimateCoingeckoProvider = async (
  data: DataEstimateRequest
): Promise<SolverEstimateProviderResponse> => {
  try {
    const getExchangesListResponse = await getExchangesList()
    const getTrendingListResponse = await getTrendingList()
    console.log(getExchangesListResponse, "getExchangesListResponse")
    console.log(getTrendingListResponse, "getTrendingListResponse")

    return {
      registrarId: REGISTRAR_ID_COINGECKO,
    } as unknown as SolverEstimateProviderResponse
  } catch (e) {
    console.log("swapEstimateRefFinanceProvider: ", e)
    return {
      solverId: `${REGISTRAR_ID_COINGECKO}:0`,
      amountOut: "0",
    }
  }
}
