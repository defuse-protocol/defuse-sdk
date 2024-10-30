import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { WithdrawForm } from "./WithdrawForm"

export const WithdrawWidget = (props: WithdrawWidgetProps) => {
  return (
    <WithdrawWidgetProvider>
      <WithdrawForm {...props} />
    </WithdrawWidgetProvider>
  )
}
