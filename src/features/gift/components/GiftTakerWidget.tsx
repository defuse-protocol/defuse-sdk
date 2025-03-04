import { WidgetRoot } from "../../../components/WidgetRoot"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { GiftTakerForm, type GiftTakerWidgetProps } from "./GiftTakerForm"

export function GiftTakerWidget(props: GiftTakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <GiftTakerForm {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
