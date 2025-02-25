import { TradeNavigationLinks } from "src/components/TradeNavigationLinks"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { OtcMakerForm, type OtcMakerWidgetProps } from "./OtcMakerForm"
import { OtcMakerTrades } from "./OtcMakerTrades"

export function OtcMakerWidget(props: OtcMakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 shadow gap-0">
          <TradeNavigationLinks onNavigateSwap={props.onNavigateSwap} />
          <OtcMakerForm {...props} />
          <OtcMakerTrades
            tokenList={props.tokenList}
            generateLink={props.generateLink}
          />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
