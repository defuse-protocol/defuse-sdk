import { cn } from "src/utils/cn"
import { useTabContext } from "../../providers/TabProvider"

export function GiftHistoryTabs() {
  const { activeTab, setActiveTab } = useTabContext()
  return (
    <div className="flex flex-row justify-start items-center">
      <button
        onClick={() => setActiveTab("pending")}
        type="button"
        className={cn(
          "px-3.5 py-2 box-border text-sm font-bold text-gray-11 border-b-2 border-transparent",
          activeTab === "pending" && "border-black text-black"
        )}
      >
        Pending
      </button>
      <button
        onClick={() => setActiveTab("history")}
        type="button"
        className={cn(
          "px-3.5 py-2 box-border text-sm font-bold text-gray-11 border-b-2 border-transparent",
          activeTab === "history" && "border-black text-black"
        )}
      >
        History
      </button>
    </div>
  )
}
