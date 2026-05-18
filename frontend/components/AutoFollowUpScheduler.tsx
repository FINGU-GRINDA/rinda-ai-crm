import type React from "react"
import { useEffect, useMemo, useState } from "react"
import {
  autoScheduleFollowUps,
  completeScheduledFollowUp,
  deleteScheduledFollowUp,
  filterFollowUps,
  getDueFollowUps,
  getScheduledFollowUps,
  getUpcomingFollowUps,
  scheduleFollowUp,
} from "../services/autoFollowUpService"
import { notifyFollowUpCompleted } from "../services/notificationService"
import type { Customer, FollowUpFilterOptions, ScheduledFollowUp } from "../types"
import {
  FollowUpCalendarView,
  FollowUpCompletionModal,
  FollowUpFilterBar,
  FollowUpStatsDashboard,
} from "./followup"
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconClock,
  IconDashboard,
  IconLoader,
  IconTrash,
  IconTrendingUp,
} from "./Icons"

interface AutoFollowUpSchedulerProps {
  customers: Customer[]
  onFollowUpScheduled?: (followUp: ScheduledFollowUp) => void
}

export const AutoFollowUpScheduler: React.FC<AutoFollowUpSchedulerProps> = ({
  customers,
  onFollowUpScheduled,
}) => {
  const [scheduledFollowUps, setScheduledFollowUps] = useState<ScheduledFollowUp[]>([])
  const [dueFollowUps, setDueFollowUps] = useState<ScheduledFollowUp[]>([])
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<ScheduledFollowUp[]>([])
  const [_isLoading, setIsLoading] = useState(false)
  const [autoScheduling, setAutoScheduling] = useState(false)
  const [completingFollowUp, setCompletingFollowUp] = useState<ScheduledFollowUp | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [showStats, setShowStats] = useState(true)
  const [filters, setFilters] = useState<FollowUpFilterOptions>({})

  // Apply filters to follow-ups
  const filteredFollowUps = useMemo(() => {
    const pending = scheduledFollowUps.filter((f) => f.status === "pending")
    if (
      Object.keys(filters).length === 0 ||
      (!filters.searchQuery && !filters.status && !filters.priority && !filters.type)
    ) {
      return pending
    }
    return filterFollowUps(pending, filters, customers)
  }, [scheduledFollowUps, filters, customers])

  useEffect(() => {
    loadFollowUps()

    // Refresh every minute
    const interval = setInterval(loadFollowUps, 60000)
    return () => clearInterval(interval)
  }, [loadFollowUps])

  const loadFollowUps = () => {
    const all = getScheduledFollowUps()
    setScheduledFollowUps(all)
    setDueFollowUps(getDueFollowUps())
    setUpcomingFollowUps(getUpcomingFollowUps(7))
  }

  const handleAutoSchedule = async () => {
    setAutoScheduling(true)
    try {
      const newFollowUps = await autoScheduleFollowUps(customers)
      loadFollowUps()

      if (onFollowUpScheduled) {
        newFollowUps.forEach((f) => onFollowUpScheduled(f))
      }
    } catch (error) {
      console.error("Auto-scheduling failed:", error)
    } finally {
      setAutoScheduling(false)
    }
  }

  const _handleScheduleForCustomer = async (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId)
    if (!customer) return

    setIsLoading(true)
    try {
      const followUp = await scheduleFollowUp(customer)
      loadFollowUps()

      if (onFollowUpScheduled) {
        onFollowUpScheduled(followUp)
      }
    } catch (error) {
      console.error("Scheduling failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (followUpId: string) => {
    deleteScheduledFollowUp(followUpId)
    loadFollowUps()
  }

  const handleComplete = async (note: string) => {
    if (!completingFollowUp) return

    const customer = customers.find((c) => c.id === completingFollowUp.customerId)
    const completed = completeScheduledFollowUp(completingFollowUp.id, note)

    // Send Slack notification if customer found and follow-up was completed
    if (customer && completed) {
      await notifyFollowUpCompleted(completed, customer, note)
    }

    setCompletingFollowUp(null)
    loadFollowUps()
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((timestamp - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `오늘 ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays === 1) {
      return `내일 ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays < 0) {
      return `${Math.abs(diffDays)}일 전 (지연됨)`
    } else {
      return `${date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200"
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "low":
        return "bg-slate-100 text-slate-700 border-slate-200"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "email":
        return "이메일"
      case "call":
        return "전화"
      case "meeting":
        return "미팅"
      case "message":
        return "메시지"
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <IconClock className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-800">자동 후속 액션 스케줄</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              목록
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              캘린더
            </button>
          </div>
          {/* Stats Toggle */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-lg transition-colors ${
              showStats
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            title="통계 표시 전환"
            aria-label="통계 표시 전환"
          >
            <IconDashboard className="w-4 h-4" />
          </button>
          {/* Auto Schedule Button */}
          <button
            onClick={handleAutoSchedule}
            disabled={autoScheduling}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {autoScheduling ? (
              <>
                <IconLoader className="w-4 h-4 animate-spin" />
                <span>스케줄을 만드는 중입니다</span>
              </>
            ) : (
              <>
                <IconTrendingUp className="w-4 h-4" />
                <span>전체 자동 스케줄</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {showStats && <FollowUpStatsDashboard />}

      {/* Filter Bar */}
      <FollowUpFilterBar filters={filters} onFilterChange={setFilters} />

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <FollowUpCalendarView
          followUps={filteredFollowUps}
          customers={customers}
          onFollowUpClick={(followUp) => setCompletingFollowUp(followUp)}
        />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Due Follow-ups */}
          {dueFollowUps.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <IconAlertCircle className="w-4 h-4 text-red-600" />
                지금 실행해야 할 Follow-up ({dueFollowUps.length})
              </h4>
              <div className="space-y-2">
                {dueFollowUps.map((followUp) => {
                  const customer = customers.find((c) => c.id === followUp.customerId)
                  return (
                    <div
                      key={followUp.id}
                      className="bg-red-50 border border-red-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-800">
                              {customer?.name || "알 수 없음"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(followUp.priority)}`}
                            >
                              {followUp.priority === "high"
                                ? "높음"
                                : followUp.priority === "medium"
                                  ? "보통"
                                  : "낮음"}
                            </span>
                            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {getTypeLabel(followUp.type)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{followUp.reason}</p>
                          {followUp.content && (
                            <p className="text-xs text-slate-600 italic line-clamp-2">
                              {followUp.content}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-red-200">
                        <button
                          onClick={() => setCompletingFollowUp(followUp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <IconCheck className="w-3.5 h-3.5" />
                          완료 처리
                        </button>
                        <button
                          onClick={() => handleDelete(followUp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming Follow-ups */}
          {upcomingFollowUps.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <IconCalendar className="w-4 h-4 text-blue-600" />
                다가오는 Follow-up ({upcomingFollowUps.length})
              </h4>
              <div className="space-y-2">
                {upcomingFollowUps.map((followUp) => {
                  const customer = customers.find((c) => c.id === followUp.customerId)
                  return (
                    <div
                      key={followUp.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-800">
                              {customer?.name || "알 수 없음"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(followUp.priority)}`}
                            >
                              {followUp.priority === "high"
                                ? "높음"
                                : followUp.priority === "medium"
                                  ? "보통"
                                  : "낮음"}
                            </span>
                            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {getTypeLabel(followUp.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                            <IconClock className="w-3 h-3" />
                            <span>{formatDateTime(new Date(followUp.scheduledFor).getTime())}</span>
                          </div>
                          <p className="text-sm text-slate-600">{followUp.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => setCompletingFollowUp(followUp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <IconCheck className="w-3.5 h-3.5" />
                          완료 처리
                        </button>
                        <button
                          onClick={() => handleDelete(followUp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {dueFollowUps.length === 0 && upcomingFollowUps.length === 0 && (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconClock className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                스케줄된 Follow-up이 없습니다
              </h4>
              <p className="text-slate-500 text-sm mb-4">
                자동 스케줄링을 실행하여 고객별 Follow-up을 생성하세요.
              </p>
              <button
                onClick={handleAutoSchedule}
                disabled={autoScheduling}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {autoScheduling ? "스케줄링 중..." : "자동 스케줄링 시작"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Completion Modal */}
      <FollowUpCompletionModal
        followUp={completingFollowUp!}
        customer={
          completingFollowUp
            ? customers.find((c) => c.id === completingFollowUp.customerId)
            : undefined
        }
        onComplete={handleComplete}
        onCancel={() => setCompletingFollowUp(null)}
        isOpen={completingFollowUp !== null}
      />
    </div>
  )
}
