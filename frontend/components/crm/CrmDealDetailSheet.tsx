import { X } from "lucide-react"
import { useDeal, useUpdateDealLost } from "../../src/api/crm/hooks"
import { DEAL_STAGE_LABELS } from "../../src/api/crm/types"

interface Props {
  dealId: string | null
  onClose: () => void
}

export function CrmDealDetailSheet({ dealId, onClose }: Props) {
  const { data: deal, isLoading } = useDeal(dealId)
  const updateLost = useUpdateDealLost()

  if (!dealId) return null

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose()
        }}
      />
      <aside className="fixed top-0 right-0 z-50 h-full w-[420px] overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Deal</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading && <div className="p-4 text-sm text-slate-500">Loading…</div>}

        {deal && (
          <div className="space-y-4 p-4">
            <section>
              <div className="text-xs uppercase tracking-wide text-slate-400">Money</div>
              <div className="mt-1 text-sm text-slate-700">
                {deal.dealSize ? `${deal.currency ?? ""} ${deal.dealSize}` : "—"}
                {deal.expectedCloseDate && (
                  <span className="text-slate-400"> · close {deal.expectedCloseDate}</span>
                )}
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-slate-400">Stage</div>
              <div className="mt-1 inline-block rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
                {DEAL_STAGE_LABELS[deal.dealStage]}
              </div>
              <div className="mt-2">
                {deal.lostAt ? (
                  <button
                    type="button"
                    onClick={() => updateLost.mutate({ dealId: deal.id, lostAt: null })}
                    className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Mark this deal as lost?")) {
                        updateLost.mutate({ dealId: deal.id, lostAt: new Date().toISOString() })
                      }
                    }}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Mark as Lost
                  </button>
                )}
              </div>
            </section>

            {deal.primaryAccount && (
              <section>
                <div className="text-xs uppercase tracking-wide text-slate-400">Account</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {deal.primaryAccount.name}
                </div>
                {deal.primaryAccount.domain && (
                  <div className="text-xs text-slate-500">{deal.primaryAccount.domain}</div>
                )}
                <div className="mt-1 flex gap-2 text-xs text-slate-500">
                  {deal.primaryAccount.country && <span>{deal.primaryAccount.country}</span>}
                  {deal.primaryAccount.industry && <span>· {deal.primaryAccount.industry}</span>}
                </div>
              </section>
            )}

            {deal.primaryPerson && (
              <section>
                <div className="text-xs uppercase tracking-wide text-slate-400">Champion</div>
                <div className="mt-1 text-sm text-slate-900">{deal.primaryPerson.fullName}</div>
                {deal.primaryPerson.title && (
                  <div className="text-xs text-slate-500">{deal.primaryPerson.title}</div>
                )}
              </section>
            )}

            <section>
              <div className="text-xs uppercase tracking-wide text-slate-400">Messages</div>
              <ul className="mt-2 space-y-2">
                {deal.recentMessages.slice(0, 20).map((m) => (
                  <li
                    key={m.id}
                    className="rounded border border-slate-100 bg-slate-50 p-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          m.direction === "inbound" ? "text-blue-600" : "text-slate-600"
                        }
                      >
                        {m.direction === "inbound" ? "↓ Inbound" : "↑ Outbound"}
                        {m.contactName && <span className="text-slate-400"> · {m.contactName}</span>}
                      </span>
                      <span className="text-slate-400">
                        {new Date(m.sentAt).toLocaleDateString()}
                      </span>
                    </div>
                    {m.subject && (
                      <div className="mt-1 text-slate-700">{m.subject}</div>
                    )}
                  </li>
                ))}
                {deal.recentMessages.length === 0 && (
                  <li className="text-xs text-slate-400">No messages yet.</li>
                )}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </>
  )
}
