import { ChevronDown, CreditCard, LogOut, Mic, User } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import type { Customer } from "../types"
import { FollowUpSchedulerHeader } from "./followup"
import { IconDashboard, IconPlus, IconSearch, IconSettings, IconX } from "./Icons"
import { NotificationCenter } from "./NotificationCenter"

// Profile Dropdown Component
const ProfileDropdown: React.FC = () => {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!user) return null

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || user.email[0].toUpperCase()

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || user.email}
            className="w-8 h-8 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
        <span className="text-sm font-medium text-slate-700 hidden lg:block max-w-[120px] truncate">
          {user.name || user.email}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-800 truncate">{user.name || "User"}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false)
                // Could open profile settings here
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>프로필</span>
            </button>
            <button
              onClick={() => {
                setIsOpen(false)
                logout()
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="group relative flex">
    {children}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
)

interface AppHeaderProps {
  customers: Customer[]
  searchQuery: string
  onSearchChange: (query: string) => void
  filterIndustry: string
  onFilterChange: (industry: string) => void
  industries: string[]
  showStats: boolean
  onToggleStats: () => void
  showFollowUpScheduler: boolean
  onToggleFollowUpScheduler: () => void
  onOpenSettings: () => void
  onAddCustomer: () => void
  onOpenBusinessCardScanner: () => void
  onOpenMeetingRecorder: () => void
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  customers,
  searchQuery,
  onSearchChange,
  filterIndustry,
  onFilterChange,
  industries,
  showStats,
  onToggleStats,
  showFollowUpScheduler,
  onToggleFollowUpScheduler,
  onOpenSettings,
  onAddCustomer,
  onOpenBusinessCardScanner,
  onOpenMeetingRecorder,
}) => {
  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <IconDashboard className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-slate-800 text-lg tracking-tight">RINDA CRM</h1>
        </div>
        <div className="flex items-center gap-2">
          <ProfileDropdown />
          <button
            onClick={onAddCustomer}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2.5 flex items-center justify-center transition-all shadow-md active:scale-95 touch-target"
            aria-label="새 고객 추가"
          >
            <IconPlus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:flex bg-white border-b border-slate-200 px-6 py-4 flex-row justify-between items-center gap-4 z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <IconDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg tracking-tight">RINDA CRM</h1>
            <p className="text-xs text-slate-500">AI가 함께하는 스마트 영업 관리</p>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="search-input"
              type="text"
              placeholder="고객 검색... (Ctrl+K)"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter */}
          <select
            value={filterIndustry}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry === "all" ? "모든 산업 분야" : industry}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            {/* Business Card Scan Button */}
            <Tooltip text="명함 스캔">
              <button
                onClick={onOpenBusinessCardScanner}
                className="p-2 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                aria-label="명함 스캔"
              >
                <CreditCard className="w-4 h-4" />
              </button>
            </Tooltip>

            {/* Meeting Record Button */}
            <Tooltip text="미팅 녹음">
              <button
                onClick={onOpenMeetingRecorder}
                className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>
            </Tooltip>

            {/* Stats Toggle */}
            <Tooltip text="영업 현황 한눈에 보기">
              <button
                onClick={onToggleStats}
                className={`p-2 rounded-lg transition-colors ${
                  showStats
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <IconDashboard className="w-4 h-4" />
              </button>
            </Tooltip>

            {/* Follow-up Scheduler Toggle */}
            <FollowUpSchedulerHeader
              onClick={onToggleFollowUpScheduler}
              isActive={showFollowUpScheduler}
            />

            {/* Notification Center */}
            <NotificationCenter customers={customers} />

            {/* Settings */}
            <Tooltip text="CRM 설정">
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-lg transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <IconSettings className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip text="새로운 고객을 추가해 영업 파이프라인을 시작하세요 (Ctrl+N)">
              <button
                onClick={onAddCustomer}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 flex items-center text-sm font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                <IconPlus className="w-4 h-4 mr-2" />
                <span>새 고객 추가</span>
              </button>
            </Tooltip>

            {/* Profile Dropdown */}
            <div className="ml-2 pl-2 border-l border-slate-200">
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

// Stats Bar Component
interface StatsBarProps {
  stats: {
    total: number
    enriched: number
    proposals: number
    byStatus: Record<string, number>
  }
  lastCollectionTime: number | null
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, lastCollectionTime }) => {
  return (
    <div className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 md:gap-6 text-sm animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">전체 고객</span>
        <span className="font-bold text-slate-800">{stats.total}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">AI 분석 완료</span>
        <span className="font-bold text-violet-600">{stats.enriched}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">작성된 제안서</span>
        <span className="font-bold text-blue-600">{stats.proposals}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">성사된 거래</span>
        <span className="font-bold text-emerald-700">{stats.byStatus.won || 0}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">잠재 고객</span>
        <span className="font-bold text-slate-800">{stats.byStatus.prospect || 0}</span>
      </div>
      {lastCollectionTime && (
        <div className="flex items-center gap-2">
          <span className="text-slate-600 font-medium">마지막 수집</span>
          <span className="text-slate-700">
            {new Date(lastCollectionTime).toLocaleTimeString("ko-KR")}
          </span>
        </div>
      )}
    </div>
  )
}

export default AppHeader
