import { Callout } from "@radix-ui/themes"

export function GiftClaimedMessage() {
  return (
    <Callout.Root className="bg-warning px-3 py-2 text-warning-foreground mt-5">
      <Callout.Text className="text-xs">
        <span className="font-bold">
          Your gift is being claimed.
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
        </span>{" "}
        <span>This may take 5-10 seconds more.</span>
      </Callout.Text>
    </Callout.Root>
  )
}
