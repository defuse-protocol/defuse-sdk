import { cn } from "src/utils/cn"
import { type TabType, useTabContext } from "../../providers/TabProvider"

interface TabConfig {
  key: TabType
  title: string
}

export function GiftHistoryTabs() {
  const { activeTab, setActiveTab } = useTabContext()
  const tabs: TabConfig[] = [
    { key: "pending", title: "Pending" },
    { key: "history", title: "History" },
  ]

  return (
    <div className="flex flex-row justify-start items-center">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          type="button"
          className={cn(
            "px-3.5 py-2 box-border text-sm font-bold text-gray-11 border-b-2 border-transparent",
            activeTab === tab.key && "border-black text-black"
          )}
        >
          {tab.title}
        </button>
      ))}
    </div>
  )
}
