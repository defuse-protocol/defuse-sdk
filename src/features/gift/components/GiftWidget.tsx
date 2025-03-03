import { WidgetRoot } from "../../../components/WidgetRoot"
import { GiftForm } from "./GiftForm"
import type { GiftWidgetProps } from "./GiftForm"

export function GiftWidget(props: GiftWidgetProps) {
  return (
    <WidgetRoot>
      <GiftForm {...props} />
    </WidgetRoot>
  )
}
