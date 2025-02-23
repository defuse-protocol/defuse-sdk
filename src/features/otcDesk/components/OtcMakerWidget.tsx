import { WidgetRoot } from "../../../components/WidgetRoot"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { OtcMakerForm, type OtcMakerWidgetProps } from "./OtcMakerForm"

export function OtcMakerWidget(props: OtcMakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <OtcMakerForm {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
