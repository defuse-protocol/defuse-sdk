import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Cross2Icon } from "@radix-ui/react-icons"
import { Callout } from "@radix-ui/themes"

export function GiftTakerInvalidClaim({ error }: { error: string }) {
  return (
    <div>
      {/* Header Section */}
      <div className="flex flex-row justify-between mb-5">
        <div className="flex flex-col items-start gap-1.5">
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            Oops!
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Looks like this gift is no longer valid — it has either been claimed
            or revoked by the sender.
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Check back with the sender for an update.
          </div>
        </div>
        <div className="flex justify-center items-start">
          <div className="w-[64px] h-[64px] flex items-center justify-center rounded-full bg-red-4">
            <Cross2Icon className="size-7 text-red-a11" />
          </div>
        </div>
      </div>

      {/* Error Section */}
      {error != null && (
        <Callout.Root size="1" color="red">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
    </div>
  )
}
