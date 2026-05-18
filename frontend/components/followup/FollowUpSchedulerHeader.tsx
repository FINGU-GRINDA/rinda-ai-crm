import React, { useState, useEffect } from 'react';
import { IconClock, IconAlertCircle } from '../Icons';
import { getDueFollowUps, getUpcomingFollowUps } from '../../services/autoFollowUpService';

interface FollowUpSchedulerHeaderProps {
  onClick: () => void;
  isActive: boolean;
}

export const FollowUpSchedulerHeader: React.FC<FollowUpSchedulerHeaderProps> = ({
  onClick,
  isActive
}) => {
  const [dueCount, setDueCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    const updateCounts = () => {
      setDueCount(getDueFollowUps().length);
      setUpcomingCount(getUpcomingFollowUps(7).length);
    };

    updateCounts();

    // 1분마다 업데이트
    const interval = setInterval(updateCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalPending = dueCount + upcomingCount;
  const hasOverdue = dueCount > 0;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-blue-100 text-blue-700 shadow-sm'
          : hasOverdue
          ? 'bg-red-50 text-red-700 hover:bg-red-100'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      title="자동 후속 액션 스케줄"
      aria-label="자동 후속 액션 스케줄"
    >
      {hasOverdue ? (
        <IconAlertCircle className="w-4 h-4" />
      ) : (
        <IconClock className="w-4 h-4" />
      )}
      <span className="text-sm font-medium hidden sm:inline">후속 액션</span>
      {totalPending > 0 && (
        <span
          className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold transition-all ${
            hasOverdue
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-blue-500 text-white'
          }`}
        >
          {totalPending > 99 ? '99+' : totalPending}
        </span>
      )}
    </button>
  );
};

export default FollowUpSchedulerHeader;
