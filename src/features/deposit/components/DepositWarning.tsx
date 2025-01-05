import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout } from "@radix-ui/themes"
import type { ReactNode } from "react"
import type { Context } from "../../machines/depositUIMachine"

export const DepositWarning = ({
  userAddress,
  depositWarning,
}: {
  userAddress: string | null
  depositWarning: Context["depositOutput"]
}) => {
  let content: ReactNode = null
  if (!userAddress) {
    content = "Please connect your wallet to continue"
  }

  if (depositWarning?.tag === "err") {
    // Check if the errorResult has a 'reason' property
    const status =
      "reason" in depositWarning.value
        ? depositWarning.value.reason
        : "An error occurred. Please try again."

    switch (status) {
      case "ERR_SUBMITTING_TRANSACTION":
        content =
          "It seems the transaction was rejected in your wallet. Please try again."
        break
      //   case "ERR_GENERATING_ADDRESS":
      //     content =
      //       "It seems the deposit address was not generated. Please try re-selecting the token and network."
      //     break
      //   case "ERR_FETCH_BALANCE":
      //     content = "It seems the balance is not available. Please try again."
      //     break
      default:
        content = "An error occurred. Please try again."
    }
  }

  if (!content) {
    return null
  }

  return (
    <Callout.Root size={"1"} color="red" mt="4">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{content}</Callout.Text>
    </Callout.Root>
  )
}
