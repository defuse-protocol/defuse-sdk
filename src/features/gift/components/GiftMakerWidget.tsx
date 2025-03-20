import { WidgetRoot } from "../../../components/WidgetRoot"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { GiftMakerForm } from "./GiftMakerForm"
import type { GiftMakerWidgetProps } from "./GiftMakerForm"

export function GiftMakerWidget(props: GiftMakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <GiftMakerForm {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
