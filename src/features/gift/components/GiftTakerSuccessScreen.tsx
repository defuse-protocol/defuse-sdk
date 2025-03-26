import { useQuery } from "@tanstack/react-query"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import { CopyButton } from "../../../components/IntentCard/CopyButton"
import { waitForIntentSettlement } from "../../../services/intentService"
import { assert } from "../../../utils/assert"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import { GiftStrip } from "./GiftStrip"
import { ActionIcon } from "./shared/ActionIcon"
import { GiftDescription } from "./shared/GiftDescription"
import { GiftHeader } from "./shared/GiftHeader"

const NEAR_EXPLORER = "https://nearblocks.io"

export function GiftTakerSuccessScreen({
  giftInfo,
  intentHashes,
}: {
  giftInfo: GiftInfo
  intentHashes: string[]
}) {
  const amount = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftInfo.token),
    giftInfo.tokenDiff,
    { strict: false }
  )

  assert(amount != null)

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
    <>
      <GiftHeader title="Gift claimed!" icon={<ActionIcon type="success" />}>
        <GiftDescription description="The funds are now in your account. Use them for trading or withdraw to your wallet." />
      </GiftHeader>

      {/* Gift Section */}
      <div className="flex flex-col text-xs mt-4 bg-gray-4 rounded-lg">
        <div className="flex flex-row border-b border-gray-6 p-3">
          <GiftStrip token={giftInfo.token} amount={amount} />
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
    </>
  )
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`
}
