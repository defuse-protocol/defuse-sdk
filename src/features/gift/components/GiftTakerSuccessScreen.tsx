import { Check as CheckIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { CopyButton } from "src/components/IntentCard/CopyButton"
import { waitForIntentSettlement } from "src/services/intentService"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import { assert } from "../../../utils/assert"
import type { GiftTerms } from "../utils/deriveGiftTerms"
import { GiftStrip } from "./GiftStrip"

const NEAR_EXPLORER = "https://nearblocks.io"

export function GiftTakerSuccessScreen({
  giftTerms,
  intentHashes,
}: {
  giftTerms: GiftTerms
  intentHashes: string[]
}) {
  const amountIn = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftTerms.tokenIn),
    giftTerms.tokenDiff,
    { strict: false }
  )
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("amountIn", amountIn)

  assert(amountIn != null)

  const intentStatus = useQuery({
    queryKey: ["intents_status", intentHashes],
    queryFn: async ({ signal }) => {
      const intentHash = intentHashes[0]
      assert(intentHash != null)
      return waitForIntentSettlement(signal, intentHash)
    },
  })

  const txUrl =
    intentStatus.data?.txHash != null
      ? `${NEAR_EXPLORER}/txns/${intentStatus.data.txHash}`
      : null

  return (
    <div>
      {/* Header Section */}
      <div className="flex flex-row justify-between mb-5">
        <div className="flex flex-col items-start gap-1.5">
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            {intentStatus.isPending ? "You Gift on the way" : "Gift claimed!"}
          </div>
          {intentStatus.isPending ? (
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Your gift is being processed.
            </div>
          ) : (
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              The funds are now in your account. Use them for trading or
              withdraw to your wallet.
            </div>
          )}
        </div>
        <div className="flex justify-center items-start">
          <div className="w-[64px] h-[64px] flex items-center justify-center rounded-full bg-green-4">
            <CheckIcon weight="bold" className="size-7 text-green-a11" />
          </div>
        </div>
      </div>

      {/* Gift Section */}
      <div className="flex flex-col text-xs mt-4 bg-gray-4 rounded-lg">
        <div className="flex flex-row border-b border-gray-6 p-3">
          <GiftStrip tokenIn={giftTerms.tokenIn} amountIn={amountIn} />
        </div>
        <div className="flex flex-col gap-3.5 text-xs p-3">
          <div className="flex justify-between items-center">
            <div className="text-gray-11 font-medium">Intents</div>
            <div className="flex gap-2.5">
              {intentHashes.map((intentHash) => (
                <div
                  key={intentHash}
                  className="flex flex-row items-center gap-1 text-gray-12 font-medium"
                >
                  <span className="text-gray-12 font-medium">
                    {truncateHash(intentHash)}
                  </span>
                  <CopyButton text={intentHash} ariaLabel="Copy intent hash" />
                </div>
              ))}
            </div>
          </div>
          {txUrl != null && (
            <div className="flex justify-between items-center">
              <div className="text-gray-11 font-medium">Transaction hash</div>
              {intentStatus.data?.txHash && (
                <div className="flex flex-row items-center gap-1 text-blue-c11 font-medium">
                  <a href={txUrl} rel="noopener noreferrer" target="_blank">
                    {truncateHash(intentStatus.data.txHash)}
                  </a>
                  <CopyButton
                    text={intentStatus.data.txHash}
                    ariaLabel="Copy intent hash"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`
}
