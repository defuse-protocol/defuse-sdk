import { useMemo } from "react"
import { SwapWidgetProvider } from "src/providers/SwapWidgetProvider"
import type { ChainType } from "src/types/deposit"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { cn } from "../../../utils/cn"
import type { GiftPayload } from "../types/sharedTypes"
import { GiftMakerHistory } from "./GiftMakerHistory"

export type GiftHistoryWidgetProps = {
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined
  generateLink: (giftPayload: GiftPayload) => string
}

export function GiftHistoryWidget(props: GiftHistoryWidgetProps) {
  const signerCredentials: SignerCredentials | null = useMemo(() => {
    return props.userAddress != null && props.userChainType != null
      ? {
          credential: props.userAddress,
          credentialType: props.userChainType,
        }
      : null
  }, [props.userChainType, props.userAddress])

  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container flex flex-col gap-4 p-5">
          <GiftHistoryTabs />
          {signerCredentials != null && (
            <GiftMakerHistory
              signerCredentials={signerCredentials}
              generateLink={props.generateLink}
            />
          )}
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}

function GiftHistoryTabs() {
  return (
    <div className="flex flex-row justify-start items-center">
      <button
        type="button"
        className={cn(
          "px-3.5 py-2 box-border text-sm font-bold box-border border-b-2 border-black"
        )}
      >
        Pending
      </button>
      <button
        type="button"
        className={cn("px-3.5 py-2 box-border text-sm font-bold text-gray-11")}
      >
        History
      </button>
    </div>
  )
}
