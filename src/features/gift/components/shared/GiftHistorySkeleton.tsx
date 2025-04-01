import { Skeleton } from "@radix-ui/themes"

export function GiftHistorySkeleton() {
  return (
    <div className="w-full flex flex-col gap-2">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  )
}
