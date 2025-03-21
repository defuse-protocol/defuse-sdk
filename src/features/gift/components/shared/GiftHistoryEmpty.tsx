export function GiftHistoryEmpty({ tag }: { tag: "pending" | "history" }) {
  return (
    <div className="bg-gray-3 rounded-lg px-4 py-3.5 font-medium text-sm text-gray-11">
      No {tag} gifts found
    </div>
  )
}
