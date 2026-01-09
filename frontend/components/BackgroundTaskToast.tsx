import React, { useState, useEffect } from 'react';
import { BackgroundTask } from '../types';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { IconCheck, IconX, IconLoader, IconFileText, IconBrain } from './Icons';

interface BackgroundTaskToastProps {
  onViewResult?: (task: BackgroundTask) => void;
}

export const BackgroundTaskToast: React.FC<BackgroundTaskToastProps> = ({ onViewResult }) => {
  const { tasks, dismissTask } = useBackgroundTasks();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Auto-collapse completed tasks after 10 seconds
  useEffect(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'error');

    completedTasks.forEach(task => {
      const timer = setTimeout(() => {
        // Don't auto-dismiss, but could add this behavior if desired
      }, 10000);

      return () => clearTimeout(timer);
    });
  }, [tasks]);

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Only show running, completed, and error tasks (not dismissed ones)
  const visibleTasks = tasks.filter(t =>
    t.status === 'running' || t.status === 'pending' ||
    t.status === 'completed' || t.status === 'error'
  );

  if (visibleTasks.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm w-full">
      {visibleTasks.map(task => (
        <div
          key={task.id}
          className={`bg-white rounded-xl shadow-2xl border overflow-hidden transform transition-all duration-300 animate-in slide-in-from-right ${
            task.status === 'completed' ? 'border-emerald-200' :
            task.status === 'error' ? 'border-red-200' :
            'border-blue-200'
          }`}
        >
          {/* Header */}
          <div
            className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
              task.status === 'completed' ? 'bg-gradient-to-r from-emerald-50 to-green-50' :
              task.status === 'error' ? 'bg-gradient-to-r from-red-50 to-rose-50' :
              'bg-gradient-to-r from-blue-50 to-indigo-50'
            }`}
            onClick={() => toggleExpand(task.id)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Status Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                task.status === 'completed' ? 'bg-emerald-100' :
                task.status === 'error' ? 'bg-red-100' :
                'bg-blue-100'
              }`}>
                {task.status === 'running' || task.status === 'pending' ? (
                  <IconLoader className="w-4 h-4 text-blue-600 animate-spin" />
                ) : task.status === 'completed' ? (
                  <IconCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <IconX className="w-4 h-4 text-red-600" />
                )}
              </div>

              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <IconFileText className={`w-4 h-4 flex-shrink-0 ${
                    task.status === 'completed' ? 'text-emerald-600' :
                    task.status === 'error' ? 'text-red-600' :
                    'text-blue-600'
                  }`} />
                  <h4 className="font-semibold text-sm text-slate-800 truncate">
                    {task.customerName} 제안서
                  </h4>
                </div>
                <p className={`text-xs mt-0.5 truncate ${
                  task.status === 'completed' ? 'text-emerald-600' :
                  task.status === 'error' ? 'text-red-600' :
                  'text-slate-500'
                }`}>
                  {task.message}
                </p>
              </div>
            </div>

            {/* Close Button */}
            {(task.status === 'completed' || task.status === 'error') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissTask(task.id);
                }}
                className="flex-shrink-0 ml-2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress Bar (for running tasks) */}
          {(task.status === 'running' || task.status === 'pending') && (
            <div className="px-4 pb-3 bg-white">
              <div className="relative pt-2">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-400">{task.progress}%</span>
                  <span className="text-xs text-slate-400">
                    {Math.ceil((100 - task.progress) / 10)}초 남음
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Expanded Content */}
          {expandedTasks.has(task.id) && (
            <div className="px-4 pb-4 bg-white border-t border-slate-100">
              {/* Progress Steps for Running */}
              {(task.status === 'running' || task.status === 'pending') && (
                <div className="pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      task.progress >= 20 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {task.progress >= 20 ? <IconCheck className="w-3 h-3" /> : '1'}
                    </div>
                    <span className={task.progress >= 20 ? 'text-emerald-600' : 'text-slate-500'}>
                      준비 단계
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      task.progress >= 60 ? 'bg-emerald-100 text-emerald-600' :
                      task.progress >= 20 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {task.progress >= 60 ? <IconCheck className="w-3 h-3" /> :
                       task.progress >= 20 ? <IconLoader className="w-3 h-3 animate-spin" /> : '2'}
                    </div>
                    <span className={
                      task.progress >= 60 ? 'text-emerald-600' :
                      task.progress >= 20 ? 'text-blue-600 font-medium' : 'text-slate-500'
                    }>
                      제안서 내용 작성 (Gemini 3 Pro)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      task.progress >= 90 ? 'bg-emerald-100 text-emerald-600' :
                      task.progress >= 60 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {task.progress >= 90 ? <IconCheck className="w-3 h-3" /> :
                       task.progress >= 60 ? <IconLoader className="w-3 h-3 animate-spin" /> : '3'}
                    </div>
                    <span className={
                      task.progress >= 90 ? 'text-emerald-600' :
                      task.progress >= 60 ? 'text-blue-600 font-medium' : 'text-slate-500'
                    }>
                      커버 이미지 생성
                    </span>
                  </div>
                </div>
              )}

              {/* Completed Actions */}
              {task.status === 'completed' && task.result && (
                <div className="pt-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <IconCheck className="w-4 h-4" />
                    <span>제안서 생성이 완료되었습니다!</span>
                  </div>

                  {/* Preview */}
                  {task.result.imageUrl && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <img
                        src={task.result.imageUrl}
                        alt="제안서 커버"
                        className="w-full h-24 object-cover"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewResult?.(task)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <IconFileText className="w-4 h-4" />
                      제안서 보기
                    </button>
                    <button
                      onClick={() => dismissTask(task.id)}
                      className="px-3 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}

              {/* Error Info */}
              {task.status === 'error' && (
                <div className="pt-3 space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{task.error}</p>
                  </div>
                  <button
                    onClick={() => dismissTask(task.id)}
                    className="w-full px-3 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-3 text-xs text-slate-400 text-right">
                시작: {new Date(task.createdAt).toLocaleTimeString('ko-KR')}
                {task.completedAt && (
                  <> / 완료: {new Date(task.completedAt).toLocaleTimeString('ko-KR')}</>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Mini Badge for Multiple Tasks */}
      {visibleTasks.length > 1 && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 text-white text-xs rounded-full">
            <IconBrain className="w-3 h-3" />
            {visibleTasks.filter(t => t.status === 'running' || t.status === 'pending').length}개 작업 진행 중
          </span>
        </div>
      )}
    </div>
  );
};

export default BackgroundTaskToast;
