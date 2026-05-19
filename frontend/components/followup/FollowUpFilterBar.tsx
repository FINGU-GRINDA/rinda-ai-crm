import type React from "react"
import type {
  FollowUpFilterOptions,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
} from "../../types"
import { IconSearch, IconX } from "../Icons"

interface FollowUpFilterBarProps {
  filters: FollowUpFilterOptions
  onFilterChange: (filters: FollowUpFilterOptions) => void
}

export const FollowUpFilterBar: React.FC<FollowUpFilterBarProps> = ({
  filters,
  onFilterChange,
}) => {
  const hasActiveFilters =
    (filters.status && filters.status.length > 0) ||
    (filters.priority && filters.priority.length > 0) ||
    (filters.type && filters.type.length > 0) ||
    (filters.searchQuery && filters.searchQuery.trim().length > 0)

  const handleClearFilters = () => {
    onFilterChange({})
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search Input */}
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="고객명, 내용으로 검색..."
            value={filters.searchQuery || ""}
            onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Status Filter */}
      <select
        value={filters.status?.[0] || ""}
        onChange={(e) =>
          onFilterChange({
            ...filters,
            status: e.target.value ? [e.target.value as FollowUpStatus] : undefined,
          })
        }
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
      >
        <option value="">모든 상태</option>
        <option value="pending">대기중</option>
        <option value="completed">완료</option>
        <option value="cancelled">취소됨</option>
      </select>

      {/* Priority Filter */}
      <select
        value={filters.priority?.[0] || ""}
        onChange={(e) =>
          onFilterChange({
            ...filters,
            priority: e.target.value ? [e.target.value as FollowUpPriority] : undefined,
          })
        }
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
      >
        <option value="">모든 우선순위</option>
        <option value="high">높음</option>
        <option value="medium">보통</option>
        <option value="low">낮음</option>
      </select>

      {/* Type Filter */}
      <select
        value={filters.type?.[0] || ""}
        onChange={(e) =>
          onFilterChange({
            ...filters,
            type: e.target.value ? [e.target.value as FollowUpType] : undefined,
          })
        }
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
      >
        <option value="">모든 유형</option>
        <option value="email">이메일</option>
        <option value="call">전화</option>
        <option value="meeting">미팅</option>
        <option value="message">메시지</option>
      </select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <IconX className="w-4 h-4" />
          필터 초기화
        </button>
      )}
    </div>
  )
}

export default FollowUpFilterBar
