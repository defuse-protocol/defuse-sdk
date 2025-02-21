import { retry } from "@lifeomic/attempt"
import { providers } from "near-api-js"
import { FailoverRpcProvider } from "near-api-js/lib/providers"
import { settings } from "../config/settings"

/**
 * @params fn - a function that takes a url and returns a promise
 * @params urls - an array of URLs to attempt
 */
export async function failover<T>(
  urls: string[],
  fn: (url: string) => Promise<T>
) {
  let index = 0

  const result = await retry(
    async () => {
      if (index >= urls.length) throw new Error("All providers failed")

      const url = urls[index++]
      if (!url) {
        throw new Error("URL is undefined")
      }

      return await fn(url)
    },
    {
      maxAttempts: 5,
      minDelay: 500,
      factor: 1.5,
      delay: 500,
    }
  )

  return result
}

/**
 * @note This function is specifically designed for NEAR RPC providers and should not be used with other blockchain networks.
 * It creates a failover provider that will automatically switch between the provided RPC endpoints if one fails.
 */
export function failoverRpcProvider({ urls }: { urls: string[] }) {
  const defaultUrls = settings.reserveRpcUrls.near || urls
  const providers_ = defaultUrls.map(
    (url) => new providers.JsonRpcProvider({ url })
  )
  return createFailoverRpcProvider({ providers: providers_ })
}

export function createFailoverRpcProvider({
  providers,
}: { providers: providers.JsonRpcProvider[] }) {
  return new FailoverRpcProvider(providers)
}
