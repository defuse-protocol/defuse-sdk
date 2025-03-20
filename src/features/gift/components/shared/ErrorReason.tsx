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
      <Callout.Text>{reason}</Callout.Text>
    </Callout.Root>
  )
}
