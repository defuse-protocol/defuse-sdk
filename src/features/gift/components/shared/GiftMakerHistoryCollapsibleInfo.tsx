import * as Accordion from "@radix-ui/react-accordion"
import { CaretDownIcon } from "@radix-ui/react-icons"
import { useQuery } from "@tanstack/react-query"
import { CopyButton } from "src/components/IntentCard/CopyButton"
import { waitForIntentSettlement } from "src/services/intentService"
import { assert } from "src/utils/assert"
import { chainTxExplorer } from "src/utils/chainTxExplorer"
import type { GiftMakerHistory } from "../../stores/giftMakerHistory"
import { formatGiftDate } from "../../utils/formattedDate"

type GiftMakerHistoryCollapsibleInfoProps = {
  children: React.ReactNode
  giftInfo: GiftMakerHistory
}

export function GiftMakerHistoryCollapsibleInfo({
  children,
  giftInfo,
}: GiftMakerHistoryCollapsibleInfoProps) {
  const formattedDate = formatGiftDate(giftInfo.updatedAt)

  const intentStatus = useQuery({
    queryKey: ["intents_status", giftInfo.intentHashes],
    queryFn: async ({ signal }) => {
      const intentHash = giftInfo.intentHashes[0]
      assert(intentHash != null)
      return waitForIntentSettlement(signal, intentHash)
    },
  })

  const txHash = intentStatus.data?.txHash
  const txUrl = txHash !== null ? `${chainTxExplorer("near")}/${txHash}` : null

  return (
    <Accordion.Root type="single" collapsible className="bg-gray-3 rounded-lg">
      <Accordion.Item value="show">
        <div className="flex justify-between items-center flex-1 p-3">
          <div className="flex-1">{children}</div>
          <Accordion.Trigger className="transition-all ml-2 [&[data-state=open]>svg]:rotate-180">
            <CaretDownIcon className="h-5 w-5 transition-transform duration-200" />
          </Accordion.Trigger>
        </div>

        <Accordion.Content className="overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          {/* Simple spacing for smooth toggle animation */}
          <div className="h-4 border-t border-gray-6 pb-3" />

          <div className="flex flex-col gap-3.5 font-medium text-gray-11 text-xs px-4 pb-3">
            <div className="flex justify-between">
              <div className="flex gap-1 items-center">
                <div>Created</div>
              </div>
              <div className="text-label">{formattedDate}</div>
            </div>
            <div className="flex justify-between">
              <div className="flex gap-1 items-center">
                <div>Intent</div>
              </div>
              <div className="text-label">
                {giftInfo.intentHashes.map((intentHash) => (
                  <div
                    key={intentHash}
                    className="flex flex-row items-center gap-1 text-gray-12 font-medium"
                  >
                    <span className="text-gray-12 font-medium">
                      {truncateHash(intentHash)}
                    </span>
                    <CopyButton
                      text={intentHash}
                      ariaLabel="Copy intent hash"
                    />
                  </div>
                ))}
              </div>
            </div>
            {!!txUrl && (
              <div className="flex justify-between items-center">
                <div className="text-gray-11 font-medium">Transaction hash</div>
                {txHash && (
                  <div className="flex flex-row items-center gap-1 text-blue-c11 font-medium">
                    <a href={txUrl} rel="noopener noreferrer" target="_blank">
                      {truncateHash(txHash)}
                    </a>
                    <CopyButton text={txHash} ariaLabel="Copy intent hash" />
                  </div>
                )}
              </div>
            )}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  )
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`
}
