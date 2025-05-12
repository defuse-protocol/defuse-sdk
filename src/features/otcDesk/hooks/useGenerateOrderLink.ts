import { useEffect, useState } from "react"
import { logger } from "../../../logger"
import type { MultiPayload } from "../../../types/defuse-contracts-types"

export function useGenerateOrderLink({
  multiPayload,
  tradeId,
  generateLink,
}: {
  multiPayload: MultiPayload
  tradeId: string
  generateLink: (multiPayload: MultiPayload, tradeId: string) => Promise<string>
}) {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const generateOrderLink = async () => {
      try {
        const link = await generateLink(multiPayload, tradeId)
        if (isMounted) {
          setGeneratedLink(link)
        }
      } catch {
        if (isMounted) {
          logger.error("Failed to generate link")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    generateOrderLink()
    return () => {
      isMounted = false
    }
  }, [multiPayload, tradeId, generateLink])

  const handleRetry = () => {
    setIsLoading(true)
    setGeneratedLink(null)
  }

  return { generatedLink, isLoading, handleRetry }
}
