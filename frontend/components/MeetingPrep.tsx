import React, { useState, useEffect } from 'react';
import { CalendarEvent, Customer, MeetingPreparation } from '../types';
import { generateMeetingPreparation } from '../services/calendarIntegrationService';
import { IconCalendar, IconLoader, IconBrain, IconClock, IconTrendingUp, IconLightbulb, IconXClose, IconAlertCircle } from './Icons';

interface MeetingPrepProps {
  customer: Customer;
  event: CalendarEvent;
  onClose?: () => void;
}

export const MeetingPrep: React.FC<MeetingPrepProps> = ({ customer, event, onClose }) => {
  const [preparation, setPreparation] = useState<MeetingPreparation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event.meetingPrep) {
      setPreparation(event.meetingPrep);
    } else {
      loadPreparation();
    }
  }, [event.id]);

  const loadPreparation = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const prep = await generateMeetingPreparation(customer, event);
      setPreparation(prep);
    } catch (err: any) {
      setError(err.message || '미팅 준비 자료 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-10 text-center">
        <IconLoader className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
        <h4 className="text-sm font-semibold text-slate-700 mb-2">미팅 준비 자료 생성 중...</h4>
        <p className="text-slate-500 text-sm">잠시만 기다려주세요.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <IconAlertCircle className="w-5 h-5 text-red-600" />
          <h4 className="text-sm font-semibold text-red-800">오류 발생</h4>
        </div>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={loadPreparation}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!preparation) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCalendar className="w-8 h-8 text-blue-600" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">미팅 준비 자료 없음</h4>
        <p className="text-slate-500 text-sm mb-4">
          미팅 준비 자료를 생성하시겠습니까?
        </p>
        <button
          onClick={loadPreparation}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          준비 자료 생성하기
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <IconCalendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">미팅 준비</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <IconClock className="w-4 h-4" />
            <span>{formatTime(event.startTime)}</span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <IconXClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start gap-2 mb-2">
          <IconBrain className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <h4 className="text-sm font-semibold text-slate-800">요약</h4>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{preparation.summary}</p>
      </div>

      {/* Key Points */}
      {preparation.keyPoints.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <IconTrendingUp className="w-4 h-4 text-blue-600" />
            핵심 포인트
          </h4>
          <ul className="space-y-2">
            {preparation.keyPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="flex-1">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Topics */}
      {preparation.suggestedTopics.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <IconLightbulb className="w-4 h-4 text-yellow-600" />
            제안할 주제
          </h4>
          <div className="flex flex-wrap gap-2">
            {preparation.suggestedTopics.map((topic, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg text-xs font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate Button */}
      <button
        onClick={loadPreparation}
        className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
      >
        준비 자료 다시 생성하기
      </button>
    </div>
  );
};

