import type React from "react"
import { useMemo, useState } from "react"
import type { Customer, FollowUpType, ScheduledFollowUp } from "../../types"
import { IconCalendar, IconChevronDown, IconChevronUp, IconMail, IconMessageSquare } from "../Icons"

interface FollowUpCalendarViewProps {
  followUps: ScheduledFollowUp[]
  customers: Customer[]
  onFollowUpClick: (followUp: ScheduledFollowUp) => void
  onDateClick?: (date: Date) => void
}

const getTypeIcon = (type: FollowUpType) => {
  switch (type) {
    case "email":
      return <IconMail className="w-3 h-3" />
    case "call":
      return <IconMessageSquare className="w-3 h-3" />
    case "meeting":
      return <IconCalendar className="w-3 h-3" />
    case "message":
      return <IconMessageSquare className="w-3 h-3" />
    default:
      return <IconMail className="w-3 h-3" />
  }
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

export const FollowUpCalendarView: React.FC<FollowUpCalendarViewProps> = ({
  followUps,
  customers,
  onFollowUpClick,
  onDateClick,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    const startDay = firstDayOfMonth.getDay()
    const daysInMonth = lastDayOfMonth.getDate()

    const days: Date[] = []

    // Add days from previous month
    const prevMonth = new Date(year, month, 0)
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonth.getDate() - i))
    }

    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }, [currentMonth])

  // Get week days for week view
  const weekDays = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }, [])

  // Get follow-ups for a specific date
  const getFollowUpsForDate = (date: Date): ScheduledFollowUp[] => {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0)
    const endOfDay = new Date(date).setHours(23, 59, 59, 999)

    return followUps.filter(
      (f) =>
        f.status === "pending" &&
        new Date(f.scheduledFor).getTime() >= startOfDay &&
        new Date(f.scheduledFor).getTime() <= endOfDay,
    )
  }

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth()
  }

  const displayDays = viewMode === "week" ? weekDays : calendarDays

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            title="이전 달"
          >
            <IconChevronUp className="w-5 h-5 rotate-[270deg]" />
          </button>
          <span className="font-semibold text-slate-800 min-w-[140px] text-center">
            {currentMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            title="다음 달"
          >
            <IconChevronDown className="w-5 h-5 rotate-[270deg]" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
          >
            오늘
          </button>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "month"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              월
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "week"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              주
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-medium ${
              idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-slate-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 ${viewMode === "week" ? "" : ""}`}>
        {displayDays.map((date, idx) => {
          const dayFollowUps = getFollowUpsForDate(date)
          const today = isToday(date)
          const currentMonthDay = isCurrentMonth(date)

          return (
            <div
              key={idx}
              onClick={() => onDateClick?.(date)}
              className={`min-h-[80px] p-2 border-b border-r border-slate-100 cursor-pointer transition-colors ${
                today ? "bg-blue-50" : currentMonthDay ? "hover:bg-slate-50" : "bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium ${
                    today
                      ? "w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center"
                      : currentMonthDay
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayFollowUps.length > 0 && !today && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>

              {/* Follow-up Items (max 3) */}
              <div className="space-y-1">
                {dayFollowUps.slice(0, 3).map((fu) => {
                  const customer = customers.find((c) => c.id === fu.customerId)
                  return (
                    <div
                      key={fu.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onFollowUpClick(fu)
                      }}
                      className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer transition-colors ${
                        fu.priority === "high"
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : fu.priority === "medium"
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      title={`${customer?.name || "알 수 없음"}: ${fu.reason}`}
                    >
                      <span className="flex items-center gap-1">
                        {getTypeIcon(fu.type)}
                        <span className="truncate">{customer?.name}</span>
                      </span>
                    </div>
                  )
                })}
                {dayFollowUps.length > 3 && (
                  <span className="text-xs text-slate-400 pl-1">+{dayFollowUps.length - 3}개</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FollowUpCalendarView
