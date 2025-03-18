import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout } from "@radix-ui/themes"
import { ActionIcon } from "./shared/ActionIcon"
import { GiftDescription } from "./shared/GiftDescription"
import { GiftHeader } from "./shared/GiftHeader"

export function GiftTakerInvalidClaim({ error }: { error: string }) {
  return (
    <>
      <GiftHeader title="Oops!" icon={<ActionIcon type="error" />}>
        <GiftDescription
          description="Looks like this gift is no longer valid — it has either been claimed
            or revoked by the sender."
        />
        <GiftDescription description="Check back with the sender for an update." />
      </GiftHeader>

      {/* Error Section */}
      {error != null && (
        <Callout.Root size="1" color="red">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
    </>
  )
}
