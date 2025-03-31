import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout } from "@radix-ui/themes"

type ErrorReasonProps = {
  reason: string
}

export function ErrorReason({ reason }: ErrorReasonProps) {
  return (
    <Callout.Root size="1" color="red">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{renderErrorMessages(reason)}</Callout.Text>
    </Callout.Root>
  )
}

function renderErrorMessages(reason: string): string {
  switch (reason) {
    case "RELAY_PUBLISH_INSUFFICIENT_BALANCE":
      return "OOPS_UNFORTUNATELY_SOMEONE_TOOK_THIS_GIFT"
    default:
      return reason
  }
}
