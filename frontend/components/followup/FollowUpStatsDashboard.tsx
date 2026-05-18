import React from 'react';
import { FollowUpStats } from '../../types';
import { getFollowUpStats } from '../../services/autoFollowUpService';
import { IconCalendar, IconClock, IconCheck, IconAlertCircle, IconTrendingUp } from '../Icons';

interface FollowUpStatsDashboardProps {
  stats?: FollowUpStats;
}

export const FollowUpStatsDashboard: React.FC<FollowUpStatsDashboardProps> = ({
  stats: propStats
}) => {
  const stats = propStats || getFollowUpStats();

  const formatAvgTime = (ms: number): string => {
    if (ms <= 0) return '-';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return '1시간 미만';
    }
  };

  return (
    <div className="mb-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 font-medium">전체</span>
            <IconCalendar className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>

        {/* Pending */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-600 font-medium">대기중</span>
            <IconClock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-700">{stats.pending}</p>
        </div>

        {/* Overdue */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-red-600 font-medium">지연됨</span>
            <IconAlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-700">{stats.overdue}</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-emerald-600 font-medium">완료율</span>
            <IconCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">
            {stats.completionRate.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Completed */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <IconCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{stats.completed}</p>
            <p className="text-xs text-slate-500">완료됨</p>
          </div>
        </div>

        {/* Avg Completion Time */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <IconTrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">
              {formatAvgTime(stats.avgCompletionTime)}
            </p>
            <p className="text-xs text-slate-500">평균 완료 시간</p>
          </div>
        </div>

        {/* By Type */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-2">유형별</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
              이메일 {stats.byType.email}
            </span>
            <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
              전화 {stats.byType.call}
            </span>
            <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
              미팅 {stats.byType.meeting}
            </span>
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
              메시지 {stats.byType.message}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowUpStatsDashboard;
