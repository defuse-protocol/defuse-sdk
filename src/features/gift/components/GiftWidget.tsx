import { WidgetRoot } from "../../../components/WidgetRoot"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { GiftForm } from "./GiftForm"
import type { GiftWidgetProps } from "./GiftForm"

export function GiftWidget(props: GiftWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <GiftForm {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
