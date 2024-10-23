import { WithdrawWidgetProvider } from "src/providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "src/types/withdraw"
import { WithdrawForm } from "./WithdrawForm"

export const WithdrawWidget = (props: WithdrawWidgetProps) => {
  return (
    <WithdrawWidgetProvider>
      <WithdrawForm {...props} />
    </WithdrawWidgetProvider>
  )
}
