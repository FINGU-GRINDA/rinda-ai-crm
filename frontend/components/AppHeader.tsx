import React from 'react';
import { Customer } from '../types';
import { CreditCard, Mic } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { FollowUpSchedulerHeader } from './followup';
import GeminiAPIManager from '../services/geminiApiManager';
import {
  IconPlus,
  IconSearch,
  IconX,
  IconDashboard,
  IconSettings
} from './Icons';

// Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="group relative flex">
    {children}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

interface AppHeaderProps {
  customers: Customer[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterIndustry: string;
  onFilterChange: (industry: string) => void;
  industries: string[];
  showStats: boolean;
  onToggleStats: () => void;
  showFollowUpScheduler: boolean;
  onToggleFollowUpScheduler: () => void;
  onOpenSettings: () => void;
  onAddCustomer: () => void;
  onOpenBusinessCardScanner: () => void;
  onOpenMeetingRecorder: () => void;
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
  const isApiConfigured = GeminiAPIManager.getInstance().isApiKeyConfigured();

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
        <button
          onClick={onAddCustomer}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2.5 flex items-center justify-center transition-all shadow-md active:scale-95 touch-target"
          aria-label="새 고객 추가"
        >
          <IconPlus className="w-5 h-5" />
        </button>
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
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
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
            {industries.map(industry => (
              <option key={industry} value={industry}>
                {industry === 'all' ? '모든 산업 분야' : industry}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            {/* Business Card Scan Button */}
            <Tooltip text="명함 스캔">
              <button
                onClick={onOpenBusinessCardScanner}
                className="p-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
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
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                className={`p-2 rounded-lg transition-colors ${
                  isApiConfigured
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200 animate-pulse'
                }`}
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
          </div>
        </div>
      </header>
    </>
  );
};

// Stats Bar Component
interface StatsBarProps {
  stats: {
    total: number;
    enriched: number;
    proposals: number;
    byStatus: Record<string, number>;
  };
  lastCollectionTime: number | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, lastCollectionTime }) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 md:gap-6 text-sm animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">전체 고객 수</span>
        <span className="font-bold text-slate-800">{stats.total}개</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">AI 분석 완료</span>
        <span className="font-bold text-indigo-600">{stats.enriched}개</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">작성된 제안서</span>
        <span className="font-bold text-emerald-600">{stats.proposals}개</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">성공한 계약</span>
        <span className="font-bold text-emerald-700">{stats.byStatus.won}개</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 font-medium">잠재 고객</span>
        <span className="font-bold text-purple-700">{stats.byStatus.prospect || 0}개</span>
      </div>
      {lastCollectionTime && (
        <div className="flex items-center gap-2">
          <span className="text-slate-600 font-medium">마지막 수집:</span>
          <span className="text-slate-700">{new Date(lastCollectionTime).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
};

export default AppHeader;
