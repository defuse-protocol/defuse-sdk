import { useMemo } from "react"
import { TradeNavigationLinks } from "src/components/TradeNavigationLinks"
import { Island } from "../../../components/Island"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { OtcMakerForm, type OtcMakerWidgetProps } from "./OtcMakerForm"
import { OtcMakerTrades } from "./OtcMakerTrades"

export function OtcMakerWidget(props: OtcMakerWidgetProps) {
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
        <Island className="widget-container flex flex-col gap-5">
          <TradeNavigationLinks
            currentRoute="otc"
            renderHostAppLink={props.renderHostAppLink}
          />
          <OtcMakerForm {...props} />

          {signerCredentials != null && (
            <OtcMakerTrades
              tokenList={props.tokenList}
              generateLink={props.generateLink}
              signerCredentials={signerCredentials}
              signMessage={props.signMessage}
              sendNearTransaction={props.sendNearTransaction}
            />
          )}
        </Island>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
