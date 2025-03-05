import { WidgetRoot } from "../../../components/WidgetRoot"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { GiftTakerWidgetProps } from "./GiftTakerForm"

export function GiftTakerWidget(props: GiftTakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <GiftTakerScreens {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}

// biome-ignore lint/correctness/noUnusedVariables: it's fine
function GiftTakerScreens(props: GiftTakerWidgetProps) {
  // biome-ignore lint/correctness/noUnusedVariables: it's fine
  const loading = <div>Loading...</div>

  return <div>GiftTakerScreens</div>
}
