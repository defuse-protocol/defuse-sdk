import {
  QueryClient,
  QueryClientProvider as RCProvider,
} from "@tanstack/react-query"
import type { PropsWithChildren } from "react"
import { settings } from "../constants/settings"

// todo: accept queryClient instance from user
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: settings.queries,
  },
})

export const QueryClientProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return <RCProvider client={queryClient}>{children}</RCProvider>
}
