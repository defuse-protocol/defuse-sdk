import { type ReactNode, createContext, useContext, useState } from "react"

type TabContextType = {
  activeTab: "pending" | "history"
  setActiveTab: (tab: "pending" | "history") => void
}

const TabContext = createContext<TabContextType | undefined>(undefined)

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  )
}

export const useTabContext = () => {
  const context = useContext(TabContext)
  if (!context) {
    throw new Error("useTabContext must be used within a TabProvider")
  }
  return context
}

export const usePendingTab = () => {
  const { activeTab } = useTabContext()
  return activeTab === "pending"
}

export const useHistoryTab = () => {
  const { activeTab } = useTabContext()
  return activeTab === "history"
}
