import {
  type PropsWithChildren,
  createContext,
  useContext,
  useState,
} from "react"

interface UserContextType {
  userAddress: string
  setUserAddress: (address: string) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

// We need this provider to avoid props drilling when using the modal dialogs
// and deep siblings components.
// Possible improvement:
// - Use cashed some token info in the user context to avoid re-fetching them
export const UserProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<UserContextType>({
    userAddress: "",
    setUserAddress: (address) => {
      setState((prev) => ({ ...prev, userAddress: address }))
    },
  })

  return <UserContext.Provider value={state}>{children}</UserContext.Provider>
}
