import React, { useCallback, useRef, useState } from "react"
import { statusBadge, toneStyles } from "../styles/design-tokens"
import type { Customer, CustomerStatus } from "../types"
import { IconArrowRight, IconBrain, IconBuilding, IconFileText, IconTrash } from "./Icons"

// Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [showTooltip, setShowTooltip] = React.useState(false)
  const tooltipId = React.useId()

  return (
    <div className="group relative flex">
      <div
        aria-describedby={showTooltip ? tooltipId : undefined}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        {children}
      </div>
      <div
        id={tooltipId}
        role="tooltip"
        className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 transition-all bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none ${
          showTooltip ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
      >
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  )
}

const KANBAN_ORDER: CustomerStatus[] = ["new", "contact", "negotiation", "won", "lost"]

export const KANBAN_COLUMNS: { id: CustomerStatus; title: string; accent: string }[] =
  KANBAN_ORDER.map((id) => ({
    id,
    title: statusBadge[id].label,
    accent: toneStyles[statusBadge[id].tone].borderLeft,
  }))

interface KanbanBoardProps {
  customers: Customer[]
  selectedCustomerId: string | null
  onSelectCustomer: (customerId: string) => void
  onDeleteCustomer: (customer: Customer) => void
  onStatusChange: (customerId: string, newStatus: CustomerStatus) => Promise<void>
  onAddCustomer?: () => void
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onDeleteCustomer,
  onStatusChange,
  onAddCustomer,
}) => {
  const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null)
  const [activeKanbanColumn, setActiveKanbanColumn] = useState(0)
  const kanbanScrollRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  const handleDragStart = useCallback((e: React.DragEvent, customerId: string) => {
    setDraggedCustomerId(customerId)
    e.dataTransfer.effectAllowed = "move"
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: CustomerStatus) => {
      e.preventDefault()
      if (!draggedCustomerId) return

      await onStatusChange(draggedCustomerId, targetStatus)
      setDraggedCustomerId(null)
    },
    [draggedCustomerId, onStatusChange],
  )

  // Helper to safely format dates
  const formatSafeDate = (dateStr: string | number | undefined): string => {
    if (!dateStr) return new Date().toLocaleDateString()
    try {
      const date = new Date(dateStr)
      return Number.isNaN(date.getTime())
        ? new Date().toLocaleDateString()
        : date.toLocaleDateString()
    } catch {
      return new Date().toLocaleDateString()
    }
  }

  // Empty state component with contextual messages
  const EmptyState: React.FC<{ columnId: CustomerStatus }> = ({ columnId }) => {
    const messages: Record<CustomerStatus, { title: string; subtitle?: string; showCTA: boolean }> =
      {
        new: {
          title: "신규 고객이 없습니다",
          subtitle: "고객을 추가하거나 잠재 고객에서 전환해 보세요",
          showCTA: true,
        },
        contact: {
          title: "컨택 중인 고객이 없습니다",
          subtitle: "신규 고객 카드를 이 단계로 드래그해 주세요",
          showCTA: false,
        },
        negotiation: {
          title: "협상 중인 고객이 없습니다",
          subtitle: "제안서를 보낸 고객을 이 단계로 옮겨 주세요",
          showCTA: false,
        },
        won: {
          title: "성사된 거래가 없습니다",
          subtitle: "계약이 완료되면 이 단계로 이동시켜 주세요",
          showCTA: false,
        },
        lost: { title: "실주된 거래가 없습니다", showCTA: false },
      }

    const message = messages[columnId]

    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center mb-3 opacity-50">
          <IconBuilding className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-xs text-slate-500 font-medium mb-1">{message.title}</p>
        {message.subtitle && <p className="text-[10px] text-slate-400 mb-3">{message.subtitle}</p>}
        {message.showCTA && onAddCustomer && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddCustomer()
            }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            + 고객 추가
          </button>
        )}
      </div>
    )
  }

  // Customer Card Component
  const CustomerCard: React.FC<{
    customer: Customer
    showDragHandle?: boolean
  }> = ({ customer, showDragHandle = true }) => {
    return (
      <div
        key={customer.id}
        role="button"
        aria-label={`${customer.name} - ${customer.industry}`}
        tabIndex={0}
        draggable={showDragHandle}
        onDragStart={showDragHandle ? (e) => handleDragStart(e, customer.id) : undefined}
        onClick={() => onSelectCustomer(customer.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelectCustomer(customer.id)
          }
        }}
        className={`bg-white p-4 rounded-lg shadow-sm border border-neutral-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-600 hover:-translate-y-0.5 transition-all group select-none ${
          draggedCustomerId === customer.id
            ? "opacity-50 grayscale scale-95 ring-2 ring-blue-100"
            : ""
        } ${selectedCustomerId === customer.id ? "ring-2 ring-blue-600 border-blue-600" : ""}`}
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-semibold text-slate-800 text-sm flex-1">{customer.name}</h4>
          <div className="flex items-center gap-1">
            {customer.enrichedData && (
              <Tooltip text="회사 정보 수집 완료">
                <IconBrain className="w-4 h-4 text-violet-600 flex-shrink-0 ml-2" />
              </Tooltip>
            )}
            <Tooltip text="삭제">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteCustomer(customer)
                }}
                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors ml-1"
                aria-label="고객 삭제"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
            {customer.industry}
          </span>
          {customer.proposals.length > 0 && (
            <span className="text-xs text-neutral-700 bg-neutral-200 px-2 py-0.5 rounded flex items-center gap-1">
              <IconFileText className="w-3 h-3" />
              {customer.proposals.length}
            </span>
          )}
        </div>

        {customer.enrichedData?.salesOpportunity ? (
          <div className="bg-violet-50 p-2 rounded text-[11px] text-violet-900 leading-snug line-clamp-2 mb-2 border border-violet-100">
            <span className="font-semibold">AI 인사이트 · </span>
            {customer.enrichedData.salesOpportunity}
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic mb-2">
            ‘회사 정보 자동 채우기’를 실행해 보세요
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
          <span>{formatSafeDate(undefined)}</span>
          <IconArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
        </div>
      </div>
    )
  }

  // Mobile Kanban View
  const MobileKanbanView = () => (
    <div className="md:hidden flex flex-col h-full pb-20">
      {/* Column Indicator Dots */}
      <div className="flex justify-center gap-2 py-3 bg-white border-b border-slate-200">
        {KANBAN_COLUMNS.map((col, idx) => {
          const count = customers.filter((c) => c.status === col.id).length
          return (
            <button
              key={col.id}
              onClick={() => {
                setActiveKanbanColumn(idx)
                const column = columnRefs.current[idx]
                if (column && kanbanScrollRef.current) {
                  const scrollLeft = column.offsetLeft - kanbanScrollRef.current.offsetLeft
                  kanbanScrollRef.current.scrollTo({
                    left: scrollLeft,
                    behavior: "smooth",
                  })
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeKanbanColumn === idx
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              <span>{col.title}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeKanbanColumn === idx ? "bg-blue-700" : "bg-neutral-200"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Swipeable Columns Container */}
      <div
        ref={kanbanScrollRef}
        className="flex-1 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        onScroll={(e) => {
          const container = e.currentTarget
          const scrollLeft = container.scrollLeft
          const containerWidth = container.offsetWidth
          const scrollCenter = scrollLeft + containerWidth / 2

          // Find which column is at the center
          let newIndex = 0
          for (let i = 0; i < columnRefs.current.length; i++) {
            const column = columnRefs.current[i]
            if (column) {
              const columnCenter = column.offsetLeft + column.offsetWidth / 2
              if (
                scrollCenter >= columnCenter - column.offsetWidth / 2 &&
                scrollCenter < columnCenter + column.offsetWidth / 2
              ) {
                newIndex = i
                break
              }
            }
          }

          if (
            newIndex !== activeKanbanColumn &&
            newIndex >= 0 &&
            newIndex < KANBAN_COLUMNS.length
          ) {
            setActiveKanbanColumn(newIndex)
          }
        }}
      >
        <div className="flex min-w-max gap-4 px-4 py-4 h-full">
          {KANBAN_COLUMNS.map((column, idx) => {
            const columnCustomers = customers.filter((c) => c.status === column.id)
            return (
              <div
                key={column.id}
                ref={(el) => (columnRefs.current[idx] = el)}
                role="region"
                aria-label={`${column.title} 칼럼 - ${columnCustomers.length}개 항목`}
                className={`w-[85vw] flex-shrink-0 snap-center flex flex-col rounded-xl bg-white border-l-4 ${column.accent} border-r border-t border-b border-neutral-200 overflow-hidden`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="px-4 py-3 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
                  <span className="font-semibold text-sm text-neutral-900">{column.title}</span>
                  <span className="bg-neutral-200 px-2 py-0.5 rounded-full text-xs font-medium text-neutral-700">
                    {columnCustomers.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {columnCustomers.length === 0 ? (
                    <EmptyState columnId={column.id} />
                  ) : (
                    columnCustomers.map((customer) => (
                      <CustomerCard key={customer.id} customer={customer} showDragHandle={false} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // Desktop Kanban View
  const DesktopKanbanView = () => (
    <div className="hidden md:flex h-full space-x-4 md:space-x-6 min-w-max">
      {KANBAN_COLUMNS.map((column) => {
        const columnCustomers = customers.filter((c) => c.status === column.id)
        return (
          <div
            key={column.id}
            role="region"
            aria-label={`${column.title} 칼럼 - ${columnCustomers.length}개 항목`}
            className={`w-72 md:w-80 flex flex-col h-full rounded-xl transition-all duration-200 bg-white border-l-4 ${column.accent} ${
              draggedCustomerId
                ? "border-r-2 border-t-2 border-b-2 border-dashed border-blue-300"
                : "border-r border-t border-b border-neutral-200"
            }`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-neutral-200 rounded-t-xl flex justify-between items-center bg-neutral-50">
              <span className="font-semibold text-sm text-neutral-900">{column.title}</span>
              <span className="bg-neutral-200 px-2 py-0.5 rounded-full text-xs font-medium text-neutral-700">
                {columnCustomers.length}
              </span>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px]">
              {columnCustomers.length === 0 ? (
                <EmptyState columnId={column.id} />
              ) : (
                columnCustomers.map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} showDragHandle={true} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <MobileKanbanView />
      <DesktopKanbanView />
    </>
  )
}

export default KanbanBoard
