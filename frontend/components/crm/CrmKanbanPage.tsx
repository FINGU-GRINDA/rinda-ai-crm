import { useState } from "react"
import { useDeals } from "../../src/api/crm/hooks"
import type { DealListItem } from "../../src/api/crm/types"
import { CrmDealDetailSheet } from "./CrmDealDetailSheet"
import { CrmKanbanBoard } from "./CrmKanbanBoard"

const DEALS_PAGE_LIMIT = 100
const MAX_AUTO_PAGES = 10

export function CrmKanbanPage() {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const dealsQuery = useDeals({ limit: DEALS_PAGE_LIMIT })

  // Auto-fetch up to MAX_AUTO_PAGES pages, then expose a "Load more" button.
  if (
    dealsQuery.hasNextPage &&
    !dealsQuery.isFetchingNextPage &&
    (dealsQuery.data?.pages.length ?? 0) < MAX_AUTO_PAGES
  ) {
    void dealsQuery.fetchNextPage()
  }

  const allDeals: DealListItem[] = dealsQuery.data?.pages.flatMap((p) => p.items) ?? []
  const autoCapReached = (dealsQuery.data?.pages.length ?? 0) >= MAX_AUTO_PAGES
  const canLoadMore = dealsQuery.hasNextPage && autoCapReached

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Deal Pipeline</h1>
          <p className="text-xs text-slate-500">
            {allDeals.length} deal{allDeals.length === 1 ? "" : "s"}
            {dealsQuery.isFetching && " · syncing…"}
          </p>
        </div>
        {canLoadMore && (
          <button
            type="button"
            onClick={() => void dealsQuery.fetchNextPage()}
            disabled={dealsQuery.isFetchingNextPage}
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {dealsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        )}
      </header>

      {dealsQuery.isLoading && <div className="p-8 text-sm text-slate-500">Loading deals…</div>}

      {dealsQuery.error && (
        <div className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load deals: {String(dealsQuery.error)}
        </div>
      )}

      {!dealsQuery.isLoading && allDeals.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-500">
          No deals yet. Connect a Gmail mailbox and run a backfill from{" "}
          <code className="rounded bg-slate-200 px-1">POST /api/v1/crm/backfill/start</code>.
        </div>
      )}

      {allDeals.length > 0 && (
        <div className="flex-1 overflow-hidden">
          <CrmKanbanBoard deals={allDeals} onCardClick={setSelectedDealId} />
        </div>
      )}

      <CrmDealDetailSheet dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />
    </div>
  )
}
