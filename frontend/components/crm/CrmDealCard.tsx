import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { DealListItem } from "../../src/api/crm/types"

interface Props {
  deal: DealListItem
  onClick: (dealId: string) => void
}

function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const diffMs = Date.now() - t
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function CrmDealCard({ deal, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  const isLost = deal.lostAt !== null
  const lastMsg = deal.lastMessage

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Don't open the detail sheet when the user just started a drag.
        if (isDragging) return
        e.stopPropagation()
        onClick(deal.id)
      }}
      className={`cursor-grab rounded-md border bg-white p-3 shadow-sm transition hover:shadow-md ${
        isLost ? "border-red-200 bg-red-50" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {deal.primaryAccount?.name ?? "(unknown account)"}
          </div>
          {deal.primaryAccount?.domain && (
            <div className="truncate text-xs text-slate-500">{deal.primaryAccount.domain}</div>
          )}
        </div>
        {deal.isBackfilled && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            BACKFILL
          </span>
        )}
      </div>

      {deal.primaryPerson && (
        <div className="mt-2 text-xs text-slate-700">
          {deal.primaryPerson.fullName}
          {deal.primaryPerson.title && (
            <span className="text-slate-400"> · {deal.primaryPerson.title}</span>
          )}
        </div>
      )}

      {lastMsg && (
        <div className="mt-2 truncate text-xs text-slate-500">
          <span className={lastMsg.direction === "inbound" ? "text-blue-600" : "text-slate-500"}>
            {lastMsg.direction === "inbound" ? "↓" : "↑"}
          </span>{" "}
          {lastMsg.subject ?? "(no subject)"} · {formatRelative(lastMsg.sentAt)}
        </div>
      )}

      {isLost && (
        <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-red-500">
          Lost
        </div>
      )}
    </div>
  )
}
