import { cn } from "src/utils/cn"

type GiftDescriptionProps = {
  description: string
  className?: string
}

export function GiftDescription(props: GiftDescriptionProps) {
  return (
    <div
      className={cn(
        "text-sm font-medium text-gray-600 dark:text-gray-400",
        props.className
      )}
    >
      {props.description}
    </div>
  )
}
