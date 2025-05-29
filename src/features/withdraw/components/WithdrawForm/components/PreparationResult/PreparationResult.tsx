import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout } from "@radix-ui/themes"
import type { ReactNode } from "react"
import type { TokenValue } from "src/types/base"
import type { PreparationOutput } from "../../../../../../services/withdrawService"
import { formatTokenValue } from "../../../../../../utils/format"

export const PreparationResult = ({
  preparationOutput,
  increaseAmount,
  decreaseAmount,
}: {
  preparationOutput: PreparationOutput | null
  increaseAmount: (v: TokenValue) => void
  decreaseAmount: (v: TokenValue) => void
}) => {
  if (preparationOutput?.tag !== "err") return null

  let content: ReactNode = null
  const err = preparationOutput.value
  const val = err.reason

  switch (val) {
    case "ERR_NEP141_STORAGE":
      content = val
      break
    case "ERR_CANNOT_FETCH_POA_BRIDGE_INFO":
      content = "Cannot fetch POA Bridge info"
      break
    case "ERR_BALANCE_INSUFFICIENT":
      // Don't duplicate error messages, this should be handled by input validation
      break
    case "ERR_AMOUNT_TOO_LOW":
      content = `Need ${formatTokenValue(err.minWithdrawalAmount - err.receivedAmount, err.token.decimals)} ${err.token.symbol} more to withdraw (considering fee)`
      break
    case "ERR_NO_QUOTES":
    case "ERR_INSUFFICIENT_AMOUNT":
      // Don't duplicate error messages, message should be displayed in the submit button
      break
    case "ERR_CANNOT_FETCH_QUOTE":
      content = "Cannot fetch quote"
      break
    case "ERR_BALANCE_FETCH":
    case "ERR_BALANCE_MISSING":
      content = "Cannot fetch balance"
      break
    case "ERR_UNFULFILLABLE_AMOUNT":
      content = (
        <>
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
          Specified amount cannot be withdrawn. Please,{" "}
          <Button
            onClick={() => {
              decreaseAmount(err.shortfall)
            }}
            variant="ghost"
            className="underline"
          >
            decrease
          </Button>
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
          {" or "}
          <Button
            onClick={() => {
              if (err.overage != null) {
                increaseAmount(err.overage)
              }
            }}
            variant="ghost"
            className="underline"
          >
            increase
          </Button>
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
          {" for slight amount."}
        </>
      )
      break
    default:
      val satisfies never
      content = val
  }

  if (content == null) return null

  return (
    <Callout.Root size="1" color="red">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{content}</Callout.Text>
    </Callout.Root>
  )
}
