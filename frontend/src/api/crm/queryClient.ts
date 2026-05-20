import { QueryClient } from "@tanstack/react-query"

/**
 * Single QueryClient for the CRM kanban. Cache defaults match the source's
 * settings: 30s stale (the classifier runs in the background, so a fresh
 * refetch on focus is expected) and 5min gc (revisits hit cache).
 */
export const crmQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})
