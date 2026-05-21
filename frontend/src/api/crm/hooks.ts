/**
 * TanStack Query hooks for the CRM kanban.
 *
 * - useDeals — paginated list with `lostFilter` ('active' | 'all' | 'only')
 * - useDeal — single deal with messages
 * - useDealMessages — paginated message list
 * - useUpdateDealStage — optimistic patch with snapshot/restore on error
 * - useUpdateDealLost — same pattern for the lost flag
 *
 * Optimistic update pattern follows source's `crm-deals-optimistic.ts`:
 *   onMutate    → cancel in-flight queries, snapshot every list variant, patch
 *                  the cached deal across all of them
 *   onError     → restore every snapshotted page
 *   onSettled   → invalidate to fetch authoritative state
 */

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { type ApiSuccess, crmFetch } from "./client"
import type { DealDetail, DealListItem, DealStage, ListDealsResult } from "./types"

// ---------- query keys ----------

export const crmDealKeys = {
  all: ["crm", "deals"] as const,
  lists: () => [...crmDealKeys.all, "list"] as const,
  list: (params?: ListDealsParams) => [...crmDealKeys.lists(), params ?? {}] as const,
  details: () => [...crmDealKeys.all, "detail"] as const,
  detail: (id: string) => [...crmDealKeys.details(), id] as const,
}

export const crmMessageKeys = {
  all: ["crm", "messages"] as const,
  byDeal: (dealId: string) => [...crmMessageKeys.all, { dealId }] as const,
}

// ---------- list ----------

export interface ListDealsParams {
  dealStage?: DealStage
  isBackfilled?: boolean
  includeLost?: boolean
  onlyLost?: boolean
  limit?: number
}

function buildQuery(params: ListDealsParams, cursor?: string): string {
  const qs = new URLSearchParams()
  if (params.dealStage) qs.set("dealStage", params.dealStage)
  if (typeof params.isBackfilled === "boolean") qs.set("isBackfilled", String(params.isBackfilled))
  if (params.includeLost) qs.set("includeLost", "true")
  if (params.onlyLost) qs.set("onlyLost", "true")
  if (params.limit) qs.set("limit", String(params.limit))
  if (cursor) qs.set("cursor", cursor)
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export function useDeals(params: ListDealsParams = {}) {
  return useInfiniteQuery({
    queryKey: crmDealKeys.list(params),
    queryFn: async ({ pageParam }) => {
      const res = await crmFetch<ApiSuccess<ListDealsResult>>(
        `/api/v1/crm/deals${buildQuery(params, pageParam as string | undefined)}`,
      )
      return res.data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useDeal(dealId: string | null) {
  return useQuery({
    queryKey: dealId ? crmDealKeys.detail(dealId) : ["crm", "deals", "detail", "disabled"],
    enabled: dealId !== null,
    queryFn: async () => {
      const res = await crmFetch<ApiSuccess<{ deal: DealDetail }>>(`/api/v1/crm/deals/${dealId}`)
      return res.data.deal
    },
  })
}

// ---------- mutations (optimistic) ----------

type InfiniteDealsData = InfiniteData<ListDealsResult, string | undefined>

function patchInfiniteDeal(
  data: InfiniteDealsData | undefined,
  dealId: string,
  patch: Partial<DealListItem>,
): InfiniteDealsData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === dealId ? { ...item, ...patch } : item)),
    })),
  }
}

interface UpdateDealStageVars {
  dealId: string
  dealStage: DealStage
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dealId, dealStage }: UpdateDealStageVars) => {
      const res = await crmFetch<ApiSuccess<DealListItem>>(`/api/v1/crm/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ dealStage }),
      })
      return res.data
    },
    onMutate: async ({ dealId, dealStage }) => {
      await queryClient.cancelQueries({ queryKey: crmDealKeys.lists() })
      const snapshot = queryClient.getQueriesData<InfiniteDealsData>({
        queryKey: crmDealKeys.lists(),
      })
      for (const [key, data] of snapshot) {
        queryClient.setQueryData(key, patchInfiniteDeal(data, dealId, { dealStage }))
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshot) return
      for (const [key, data] of ctx.snapshot) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: crmDealKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: crmDealKeys.detail(vars.dealId) })
    },
  })
}

interface UpdateDealLostVars {
  dealId: string
  /** null = restore (clear lost_at); non-null = mark lost (server stamps NOW). */
  lostAt: string | null
}

export function useUpdateDealLost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dealId, lostAt }: UpdateDealLostVars) => {
      const res = await crmFetch<ApiSuccess<DealListItem>>(`/api/v1/crm/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ lostAt }),
      })
      return res.data
    },
    onMutate: async ({ dealId, lostAt }) => {
      await queryClient.cancelQueries({ queryKey: crmDealKeys.lists() })
      const snapshot = queryClient.getQueriesData<InfiniteDealsData>({
        queryKey: crmDealKeys.lists(),
      })
      const optimisticLostAt = lostAt === null ? null : new Date().toISOString()
      for (const [key, data] of snapshot) {
        queryClient.setQueryData(key, patchInfiniteDeal(data, dealId, { lostAt: optimisticLostAt }))
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshot) return
      for (const [key, data] of ctx.snapshot) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: crmDealKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: crmDealKeys.detail(vars.dealId) })
    },
  })
}
