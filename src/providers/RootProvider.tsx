import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { PropsWithChildren } from "react"
import { settings } from "src/config/settings"
import { UserProvider } from "./UserContext"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: settings.queries,
  },
})

export const RootProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>{children}</UserProvider>
      {/* TODO: Remove this in production */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
