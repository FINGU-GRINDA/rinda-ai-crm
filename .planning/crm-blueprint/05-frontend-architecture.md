# 05 — Frontend Architecture

Source: [`admin/src/pages/leads/views/`](../../admin/src/pages/leads/views/), [`admin/src/pages/crm-browse/`](../../admin/src/pages/crm-browse/), [`admin/src/lib/api/hooks/crm-*.ts`](../../admin/src/lib/api/hooks/).

Stack: **React 19 + Vite + TanStack Query + Jotai + Tailwind CSS + @dnd-kit/core**. The blueprint below is framework-aware (cache + optimistic patterns matter) but transferable to any React stack.

---

## 1. Route map

| Path | Component | Purpose |
|---|---|---|
| `/leads?view=deal-pipeline` | `LeadsPipelineView` | Headline kanban — drag deals between 5 stages |
| `/leads?view=threads` | (threads view in same Leads page) | Admin debug: thread → classifier → deal funnel |
| `/leads?view=companies` | (companies view) | Accounts directory |
| `/leads?view=people` | (people view) | Persons directory |
| `/crm-browse/deals` | `DealsBrowsePage` | Flat list of all workspace deals (search + filter) |
| `/crm-browse/accounts` | `AccountsBrowsePage` | Account directory with aggregates |
| `/crm-browse/persons` | `PersonsBrowsePage` | Person directory with channel contacts |
| `/crm-browse/threads` | `ThreadsBrowsePage` | Thread rollups + classifier verdicts |

The kanban at `/leads?view=deal-pipeline` is the primary CRM surface — everything else is a debug / browse complement.

> **Lazy-load registration**: every new page must be added to [`admin/src/router/lazy-imports.ts`](../../admin/src/router/lazy-imports.ts) as `React.lazy(() => import(...))`. Vite splits the bundle per lazy boundary.

---

## 2. Kanban — `LeadsPipelineView`

File: [`admin/src/pages/leads/views/LeadsPipelineView.tsx`](../../admin/src/pages/leads/views/LeadsPipelineView.tsx)

### 2.1 Composition

```
<LeadsPipelineView>
  ├─ <PipelineHeader>          // title + subtitle + search (with match count)
  ├─ <PipelineMetricsStrip>    // KPI tiles + per-stage funnel histogram
  ├─ <LeadPipelineBoard>       // 5-column DnD kanban
  └─ <LeadDetailSheet>         // right-slide read-only detail (opens on card click)
```

### 2.2 Data loading

```ts
const DEALS_PAGE_LIMIT = 100    // server max is 200; per-page = 100
const MAX_AUTO_PAGES   = 10     // auto-load up to 1000 deals; "Load more" past that

const dealsQuery = useDeals({ limit: DEALS_PAGE_LIMIT })

// Auto-fetch next page until cap, then opt-in past it.
useEffect(() => {
  if (hasNextPage && !isFetchingNextPage && !autoCapReached) {
    fetchNextPage().catch(() => {/* TanStack holds error state */})
  }
}, [hasNextPage, isFetchingNextPage, fetchNextPage, autoCapReached])
```

After 10 pages (1000 deals) auto-load stops and a **"Load more" button** appears so the user opts in to the next chunk. Reason: silently chewing through unbounded pages starves the rest of the app.

### 2.3 Client-side search (over the loaded slice)

```ts
const filteredDeals = deals.filter(d =>
  d.primaryAccount?.name.toLowerCase().includes(q)   ||
  d.primaryAccount?.domain.toLowerCase().includes(q) ||
  d.primaryPerson?.fullName.toLowerCase().includes(q) ||
  d.lastMessage?.subject.toLowerCase().includes(q)
)
```

Match count displays next to the search input ("12 of 87"). Search is **not** server-side — works on the already-fetched slice. Past 1000 deals the user must "Load more" first.

### 2.4 The DnD board

File: [`admin/src/pages/leads/views/components/LeadPipelineBoard.tsx`](../../admin/src/pages/leads/views/components/LeadPipelineBoard.tsx)

```ts
<DndContext
  sensors={[PointerSensor, KeyboardSensor]}   // mouse + keyboard accessibility
  collisionDetection={closestCenter}
  onDragEnd={handleDrop}
>
  {STAGES.map(stage => (
    <LeadPipelineColumn key={stage} stage={stage}>
      {dealsByStage[stage].map(d => (
        <LeadPipelineCard key={d.id} deal={d} onClick={openDetail} />
      ))}
    </LeadPipelineColumn>
  ))}
  <DragOverlay>
    {activeDeal && <LeadPipelineCard deal={activeDeal} dragging />}
  </DragOverlay>
</DndContext>
```

**On drop**:
1. Identify source and destination stage.
2. If unchanged ⇒ no-op.
3. Else call `updateStageMutation.mutate({ dealId, dealStage })` — see §3.

### 2.5 Card content

`LeadPipelineCard` shows:
- Primary account name + domain
- Primary person full name + title
- Last message subject + sentAt (relative time)
- Deal size + currency (if set)
- Expected close date (if set)
- "BACKFILL" badge when `isBackfilled === true`
- "Lost" overlay when `lostAt !== null`
- "Stalled" indicator when no inbound message in N days
- "Urgent" indicator when expected_close_date is within N days

### 2.6 Detail sheet

File: [`admin/src/pages/leads/views/components/pipeline/LeadDetailSheet.tsx`](../../admin/src/pages/leads/views/components/pipeline/LeadDetailSheet.tsx)

Right-slide drawer, **read-only** in the source. Sections:
1. **Money strip**: deal_size, currency, expected_close_date
2. **5-stage progress tracker**: visual marker on the current stage
3. **Mark as Lost / Restore** action (2-click confirmation)
4. **Message thread preview**: newest first, "needs reply" highlight (when last message direction is `inbound`)
5. **Contact info**: primary person email/phone/linkedin
6. **Company metadata**: account name, domain (clickable to web), country, industry, company size

**Inline edit is deferred to v2.** Source file header:

```ts
// TODO(PRD §6): re-enable inline edit for owner / notes / amount once the
// Deal patch endpoint accepts those fields (currently dealStage only).
```

---

## 3. Optimistic update pattern (kanban DnD)

File: [`admin/src/lib/api/hooks/crm-deals.ts`](../../admin/src/lib/api/hooks/crm-deals.ts)

The mutation runs three phases: snapshot → patch → settle.

### 3.1 `useUpdateDealStage` shape

```ts
useMutation({
  mutationFn: ({ dealId, dealStage }) => crmDealsApi.updateStage(dealId, { dealStage }),

  onMutate: async ({ dealId, dealStage }) => {
    // 1. Cancel in-flight refetches so they can't clobber our patch
    await queryClient.cancelQueries({ queryKey: crmDealKeys.lists() })

    // 2. Snapshot every list query's current data
    const snapshot = queryClient.getQueriesData<InfiniteDealsData>({ queryKey: crmDealKeys.lists() })

    // 3. Patch ALL list queries (every filter variant) optimistically
    for (const [key, data] of snapshot) {
      queryClient.setQueryData(key, patchInfiniteDeal(data, dealId, { dealStage }))
    }
    return { snapshot }
  },

  onError: (_err, _vars, ctx) => {
    // Restore every snapshotted page
    if (ctx?.snapshot) {
      for (const [key, data] of ctx.snapshot) {
        queryClient.setQueryData(key, data)
      }
    }
  },

  onSettled: (_data, _err, vars) => {
    // Refetch authoritative state — server may have moved card to a different stage if classifier ran
    queryClient.invalidateQueries({ queryKey: crmDealKeys.lists() })
    queryClient.invalidateQueries({ queryKey: crmDealKeys.detail(vars.dealId) })
  },
})
```

### 3.2 Why patch every list variant

Multiple `useDeals()` calls might be alive with different filter shapes (e.g. `{}`, `{ isBackfilled: true }`, `{ dealStage: "negotiating" }`). The Sync Inspector page uses `{ isBackfilled: true }`; the kanban uses `{}`. Both must update when a card moves.

The query key prefix `crmDealKeys.lists()` (= `["crm","deals","list"]`) matches all of them. `getQueriesData` returns every match.

### 3.3 `patchInfiniteDeal` helper

Mutates an `InfiniteDealsData` tree (TanStack `InfiniteData<DealListPage>`):

```ts
function patchInfiniteDeal(
  data: InfiniteDealsData | undefined,
  dealId: string,
  patch: Partial<DealListItem>,
): InfiniteDealsData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      items: page.items.map(item => item.id === dealId ? { ...item, ...patch } : item),
    })),
  }
}
```

Same helper is used for `useUpdateDealLost` (patches `lostAt`).

### 3.4 Lost mutation refetch behavior

When the active-only filter is in effect (default), marking a deal lost optimistically moves it but the next refetch will drop it (BE filter excludes `lost_at IS NOT NULL`). The card animates out cleanly. Restore reverses: BE refetch re-adds it.

---

## 4. Pipeline metrics strip

File: [`admin/src/pages/leads/views/components/pipeline/PipelineMetricsStrip.tsx`](../../admin/src/pages/leads/views/components/pipeline/PipelineMetricsStrip.tsx)

Hook: `usePipelineMetrics(workspaceId)` from [`admin/src/lib/api/hooks/deals.ts`](../../admin/src/lib/api/hooks/deals.ts) (note: in `hooks/deals.ts`, not `hooks/crm-deals.ts`).

**KPI tiles** (typically 3-up grid `grid-cols-1 min-[850px]:grid-cols-3`):
- Total active deals
- Total deal value (sum of `deal_size` for active deals in workspace currency)
- Win rate / lost rate over rolling window

**Per-stage funnel histogram**: 5 vertical bars matching the kanban columns, height proportional to deal count per stage.

> **Endpoint**: `GET /api/v1/deals/pipeline-metrics` (note: lives outside `routes/crm/` because metrics were a separate ship). Returns `{ totalActive, totalValueUsd, byStage: { engaged: n, ... } }`.

---

## 5. Query hook layer

File: [`admin/src/lib/api/hooks/crm-deals.ts`](../../admin/src/lib/api/hooks/crm-deals.ts) (similar for crm-accounts.ts, crm-persons.ts, crm-threads.ts, crm-sync.ts).

### 5.1 Query keys

```ts
export const crmDealKeys = {
  all:     ["crm", "deals"] as const,
  lists:   () => [...crmDealKeys.all, "list"] as const,
  list:    (params?: ListDealsParams) => [...crmDealKeys.lists(), params ?? {}] as const,
  details: () => [...crmDealKeys.all, "detail"] as const,
  detail:  (id: string) => [...crmDealKeys.details(), id] as const,
}

export const crmMessageKeys = {
  all:     ["crm", "messages"] as const,
  byDeal:  (dealId: string) => [...crmMessageKeys.all, { dealId }] as const,
}
```

Hierarchical so `invalidateQueries({ queryKey: crmDealKeys.lists() })` invalidates every variant.

### 5.2 Hook surface

```ts
useDeals(params?: ListDealsParams)              // useInfiniteQuery, cursor in pageParam
useDeal(dealId: string | null)                  // useQuery
useDealMessages({ dealId, limit, enabled? })    // useInfiniteQuery for messages

useUpdateDealStage()  // mutation with optimistic patch (§3)
useUpdateDealLost()   // mutation with optimistic patch
```

### 5.3 Cache config

```ts
staleTime: 30 * 1000          // 30s — kanban tolerates mild staleness; classifier results poll on focus
gcTime:    5 * 60 * 1000      // 5 min — kanban revisits should hit cache
```

No `refetchOnWindowFocus` override — TanStack default (true) is intentional: re-focusing a tab after some time fetches the latest classifier verdicts.

### 5.4 Pagination

`useInfiniteQuery` with cursor threading:

```ts
useInfiniteQuery({
  queryKey: crmDealKeys.list(params),
  queryFn:  ({ pageParam }) => crmDealsApi.list({ ...params, cursor: pageParam as string | undefined }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
})
```

Cursor is opaque to FE — just a string passed through.

---

## 6. State management division

| Concern | Where it lives | Why |
|---|---|---|
| Server-side data (deals, accounts, messages) | TanStack Query cache | Refetchable. **Never mutated in place** — always go through `setQueryData` with a new object. |
| Selected deal id (for the detail sheet) | `useState` in `LeadsPipelineView` | Ephemeral UI state, no need to share across routes. |
| Search input | `useState` in `LeadsPipelineView` | Ephemeral. |
| Workspace selection | Jotai atom + `useWorkspace()` hook | Shared across routes; persisted to localStorage. |
| Current user | `useCurrentUser()` reading localStorage JWT | Shared but read-only after login. |

> **Forbidden patterns** ([`.claude/rules/frontend-architecture.md`](../../.claude/rules/frontend-architecture.md)):
> - `useMe()` — deprecated; use `useCurrentUser()`
> - Mutating TanStack cache data in-place
> - Server-state-shaped Jotai atoms (server state = TanStack only)

---

## 7. Auth & workspace headers

Every CRM API call must send `X-Workspace-Id: <uuid>`. The API client adds it automatically based on the active Jotai workspace atom:

```ts
// admin/src/lib/api/client.ts (existing pattern)
async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set("X-Workspace-Id", getActiveWorkspaceId())
  headers.set("Authorization", `Bearer ${getAuthToken()}`)
  // ...
}
```

On `401`/`403` ⇒ the client redirects to `/signin` (does NOT retry — TanStack mutation cycle expects errors to bubble).

---

## 8. Design system tokens (Rinda)

The frontend lives inside a tightly-managed design system ([`.claude/rules/frontend-design.md`](../../.claude/rules/frontend-design.md) — single-owner, do-not-modify file). For the rebuild, you don't need to copy this system, but a few CRM-specific patterns are worth carrying over:

### 8.1 Color tokens used in the CRM UI

- Page background: `bg-rd-n-200`
- Card background: `bg-rd-n-white`
- Active card / "BACKFILL" badge: `bg-rd-blue-50 text-rd-blue-600 border-rd-blue-200`
- Lost overlay: `bg-rd-red-100 text-rd-red-500`
- Stage indicator (active): `bg-rd-blue-100 text-rd-blue-500`

### 8.2 Typography tokens

5 semantic sizes: `text-caption (12)`, `text-body (14)`, `text-subtitle (16)`, `text-title (18)`, `text-display (22)`. **Minimum font size 12px** — `text-[10px]` and `text-[11px]` are forbidden.

### 8.3 Empty state pattern

Every list/board shows the same empty state shape (icon + main text + sub text). Reused via a shared component, not re-styled per page.

### 8.4 Kanban-specific layout

- Column width: `w-[300px]` (~5 columns at 1500px viewport)
- Card padding: `p-3`
- Card gap: `gap-2`
- Column gap: `gap-3`
- Board scroll: horizontal on narrower viewports; columns shrink with `min-w-[280px]` floor.

---

## 9. What the rebuild needs

Carry over:
- TanStack `useInfiniteQuery` + cursor pagination (no offset)
- Optimistic patch + snapshot-restore mutation pattern
- Hierarchical query keys (`["crm","deals","list",params]`) so invalidation cascades cleanly
- DnD with @dnd-kit (PointerSensor + KeyboardSensor for a11y, DragOverlay for visual handoff)
- Read-only detail sheet as the v1 shape (defer inline edit until the BE PATCH endpoint supports the fields)

Don't carry over:
- The Korean i18n constraints (this codebase has 4-language CSV files)
- The biome / typography pixel guards (those are Rinda-specific CI)
- The lazy-import registry (Vite + React.lazy will work without it in a new repo)

Add in the rebuild:
- **Inline edit** on `deal_size`, `currency`, `expected_close_date`, `incoterms`, `payment_terms` in the detail sheet — requires the BE PATCH endpoint to accept those fields (see [04-deal-lifecycle.md](04-deal-lifecycle.md) §3.4).
- **Server-side search** when the dataset grows past ~5000 deals — client-side filter over a 1000-deal slice doesn't scale.
- **Segmentation filters** on the kanban: industry, company size, buyer type, assignee (after adding `assignee_user_id`). Currently only stage + search.
- **Bulk operations**: select multiple cards (click+shift, lasso, or column-level "select all"), then bulk-move-stage / bulk-mark-lost / bulk-assign.
