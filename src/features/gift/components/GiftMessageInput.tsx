import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react"

export function GiftMessageInput({
  inputSlot,
}: {
  inputSlot?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border-0 bg-gray-3 hover:bg-gray-4 focus-within:bg-gray-4">
      <div className="flex items-center gap-4">
        {/* Amount Input */}
        <div className="relative flex-1">
          <div className="overflow-hidden">{inputSlot}</div>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-transparent" />
        </div>
      </div>
    </div>
  )
}

GiftMessageInput.Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input(props, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="text"
      autoComplete="off"
      maxLength={50}
      placeholder="Enter your message (optional)"
      className="w-full border-0 bg-transparent px-4 py-2 font-medium text-sm text-label focus:ring-0"
      {...props}
    />
  )
})
