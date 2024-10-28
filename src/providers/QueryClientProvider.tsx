import {
  QueryClient,
  QueryClientProvider as RCProvider,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { PropsWithChildren } from "react"
import { settings } from "src/config/settings"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: settings.queries,
  },
})

export const QueryClientProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <RCProvider client={queryClient}>
      {children}
      {/* TODO: Remove this in production */}
      <ReactQueryDevtools initialIsOpen={false} />
    </RCProvider>
  )
}
