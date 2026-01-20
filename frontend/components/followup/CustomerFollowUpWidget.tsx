import React, { useState, useEffect } from 'react';
import { Customer, ScheduledFollowUp, FollowUpType } from '../../types';
import {
  getCustomerFollowUps,
  scheduleFollowUp,
  completeScheduledFollowUp,
  deleteScheduledFollowUp
} from '../../services/autoFollowUpService';
import { notifyFollowUpCompleted } from '../../services/notificationService';
import { IconClock, IconPlus, IconCheck, IconTrash, IconLoader, IconSparkles, IconMail, IconMessageSquare, IconCalendar, IconAlertCircle } from '../Icons';
import { FollowUpFormModal } from './FollowUpFormModal';
import { FollowUpCompletionModal } from './FollowUpCompletionModal';

interface CustomerFollowUpWidgetProps {
  customer: Customer;
  onFollowUpChange?: () => void;
}

const getTypeIcon = (type: FollowUpType) => {
  switch (type) {
    case 'email':
      return <IconMail className="w-3.5 h-3.5 text-blue-600" />;
    case 'call':
      return <IconMessageSquare className="w-3.5 h-3.5 text-green-600" />;
    case 'meeting':
      return <IconCalendar className="w-3.5 h-3.5 text-purple-600" />;
    case 'message':
      return <IconMessageSquare className="w-3.5 h-3.5 text-orange-600" />;
    default:
      return <IconMail className="w-3.5 h-3.5 text-slate-600" />;
  }
};

const getTypeLabel = (type: FollowUpType): string => {
  switch (type) {
    case 'email':
      return '이메일';
    case 'call':
      return '전화';
    case 'meeting':
      return '미팅';
    case 'message':
      return '메시지';
    default:
      return type;
  }
};

const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((timestamp - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `내일 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 0) {
    return `${Math.abs(diffDays)}일 전 (지연됨)`;
  } else {
    return `${date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  }
};

export const CustomerFollowUpWidget: React.FC<CustomerFollowUpWidgetProps> = ({
  customer,
  onFollowUpChange
}) => {
  const [followUps, setFollowUps] = useState<ScheduledFollowUp[]>([]);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<ScheduledFollowUp | null>(null);

  // Load follow-ups for this customer
  const loadFollowUps = () => {
    const customerFollowUps = getCustomerFollowUps(customer.id);
    setFollowUps(customerFollowUps);
  };

  useEffect(() => {
    loadFollowUps();
  }, [customer.id]);

  const pendingFollowUps = followUps.filter(f => f.status === 'pending');
  const completedFollowUps = followUps.filter(f => f.status === 'completed').slice(0, 3);
  const now = new Date().toISOString();
  const overdueCount = pendingFollowUps.filter(f => f.scheduledFor <= now).length;

  const handleAutoSchedule = async () => {
    setIsAutoScheduling(true);
    try {
      await scheduleFollowUp(customer);
      loadFollowUps();
      onFollowUpChange?.();
    } catch (error) {
      console.error('Auto-scheduling failed:', error);
    } finally {
      setIsAutoScheduling(false);
    }
  };

  const handleComplete = async (note: string) => {
    if (!completingFollowUp) return;

    const completed = completeScheduledFollowUp(completingFollowUp.id, note);

    // Send Slack notification if follow-up was completed
    if (completed) {
      await notifyFollowUpCompleted(completed, customer, note);
    }

    setCompletingFollowUp(null);
    loadFollowUps();
    onFollowUpChange?.();
  };

  const handleDelete = (followUpId: string) => {
    deleteScheduledFollowUp(followUpId);
    loadFollowUps();
    onFollowUpChange?.();
  };

  const handleFormSubmit = (followUp: ScheduledFollowUp) => {
    loadFollowUps();
    onFollowUpChange?.();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <IconClock className="w-4 h-4 text-blue-600" />
          Follow-up 스케줄
          {pendingFollowUps.length > 0 && (
            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold ${
              overdueCount > 0 ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700'
            }`}>
              {pendingFollowUps.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowFormModal(true)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          새 스케줄
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Pending Follow-ups */}
        {pendingFollowUps.length > 0 ? (
          <div className="space-y-3">
            {pendingFollowUps.map(followUp => {
              const isOverdue = followUp.scheduledFor <= now;
              return (
                <div
                  key={followUp.id}
                  className={`rounded-lg p-3 ${
                    isOverdue
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(followUp.type)}
                      <span className="text-xs font-medium text-slate-600">
                        {getTypeLabel(followUp.type)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        followUp.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : followUp.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {followUp.priority === 'high' ? '높음' : followUp.priority === 'medium' ? '보통' : '낮음'}
                      </span>
                    </div>
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <IconAlertCircle className="w-3 h-3" />
                        지연됨
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                    <IconClock className="w-3 h-3" />
                    {formatDateTime(new Date(followUp.scheduledFor).getTime())}
                  </div>

                  <p className="text-sm text-slate-700 mb-3">{followUp.reason}</p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCompletingFollowUp(followUp)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors"
                    >
                      <IconCheck className="w-3 h-3" />
                      완료
                    </button>
                    <button
                      onClick={() => handleDelete(followUp.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 transition-colors"
                    >
                      <IconTrash className="w-3 h-3" />
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <IconClock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 mb-4">예정된 Follow-up이 없습니다</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleAutoSchedule}
                disabled={isAutoScheduling}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isAutoScheduling ? (
                  <>
                    <IconLoader className="w-3.5 h-3.5 animate-spin" />
                    AI 분석 중...
                  </>
                ) : (
                  <>
                    <IconSparkles className="w-3.5 h-3.5" />
                    AI 자동 스케줄링
                  </>
                )}
              </button>
              <button
                onClick={() => setShowFormModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                <IconPlus className="w-3.5 h-3.5" />
                수동 등록
              </button>
            </div>
          </div>
        )}

        {/* AI Auto-schedule button when there are pending follow-ups */}
        {pendingFollowUps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={handleAutoSchedule}
              disabled={isAutoScheduling}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {isAutoScheduling ? (
                <>
                  <IconLoader className="w-3.5 h-3.5 animate-spin" />
                  AI 분석 중...
                </>
              ) : (
                <>
                  <IconSparkles className="w-3.5 h-3.5" />
                  AI로 추가 스케줄 생성
                </>
              )}
            </button>
          </div>
        )}

        {/* Completed Follow-ups */}
        {completedFollowUps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
              <IconCheck className="w-3 h-3" />
              최근 완료된 Follow-up
            </h4>
            <div className="space-y-2">
              {completedFollowUps.map(followUp => (
                <div
                  key={followUp.id}
                  className="text-xs text-slate-500 flex items-center gap-2"
                >
                  {getTypeIcon(followUp.type)}
                  <span className="flex-1 truncate">{followUp.reason}</span>
                  <span className="text-slate-400">
                    {new Date(followUp.completedAt || followUp.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <FollowUpFormModal
        customer={customer}
        onSubmit={handleFormSubmit}
        onClose={() => setShowFormModal(false)}
        isOpen={showFormModal}
      />

      {/* Completion Modal */}
      <FollowUpCompletionModal
        followUp={completingFollowUp!}
        customer={customer}
        onComplete={handleComplete}
        onCancel={() => setCompletingFollowUp(null)}
        isOpen={completingFollowUp !== null}
      />
    </div>
  );
};

export default CustomerFollowUpWidget;
