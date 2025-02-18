import { retry } from "@lifeomic/attempt"

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
