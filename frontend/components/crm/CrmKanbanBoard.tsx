import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useState } from "react"
import { useUpdateDealStage } from "../../src/api/crm/hooks"
import { DEAL_STAGE_LABELS, DEAL_STAGES, type DealListItem, type DealStage } from "../../src/api/crm/types"
import { CrmDealCard } from "./CrmDealCard"

interface Props {
  deals: DealListItem[]
  onCardClick: (dealId: string) => void
}

function ColumnDropZone({
  stage,
  children,
}: {
  stage: DealStage
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stage}`, data: { stage } })
  return (
    <div
      ref={setNodeRef}
      className={`flex h-full flex-col gap-2 rounded-md p-2 transition ${
        isOver ? "bg-blue-50" : ""
      }`}
    >
      {children}
    </div>
  )
}

export function CrmKanbanBoard({ deals, onCardClick }: Props) {
  const [activeDeal, setActiveDeal] = useState<DealListItem | null>(null)
  const updateStage = useUpdateDealStage()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  const dealsByStage = new Map<DealStage, DealListItem[]>()
  for (const stage of DEAL_STAGES) dealsByStage.set(stage, [])
  for (const d of deals) {
    if (!d.lostAt) {
      const bucket = dealsByStage.get(d.dealStage)
      if (bucket) bucket.push(d)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const deal = deals.find((d) => d.id === event.active.id)
    setActiveDeal(deal ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return
    const overData = over.data.current as { stage?: DealStage } | undefined
    const targetStage = overData?.stage
    if (!targetStage) return
    const deal = deals.find((d) => d.id === active.id)
    if (!deal || deal.dealStage === targetStage) return
    updateStage.mutate({ dealId: String(active.id), dealStage: targetStage })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {DEAL_STAGES.map((stage) => {
          const items = dealsByStage.get(stage) ?? []
          return (
            <div
              key={stage}
              className="flex w-[300px] min-w-[280px] flex-col rounded-lg border border-slate-200 bg-slate-50"
            >
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  {DEAL_STAGE_LABELS[stage]}
                </h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {items.length}
                </span>
              </div>
              <ColumnDropZone stage={stage}>
                {items.map((deal) => (
                  <CrmDealCard key={deal.id} deal={deal} onClick={onCardClick} />
                ))}
              </ColumnDropZone>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeDeal && <CrmDealCard deal={activeDeal} onClick={() => {}} />}
      </DragOverlay>
    </DndContext>
  )
}
