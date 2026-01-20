import React, { useMemo } from 'react';
import { Prospect } from '../types';
import {
  IconBuilding,
  IconTrendingUp,
  IconNews,
  IconSparkles,
  IconExternalLink,
  IconArrowRight,
  IconCheck,
  IconX
} from './Icons';

interface ProspectsBoardProps {
  prospects: Prospect[];
  onSelectProspect: (prospectId: string) => void;
  onConvertToCustomer: (prospectId: string) => void;
  onDismissProspect: (prospectId: string) => void;
}

const SIGNAL_COLUMNS = [
  {
    id: 'high' as const,
    title: '높은 관심도',
    color: 'bg-red-50 border-red-200',
    textColor: 'text-red-700',
    badgeColor: 'bg-red-100 text-red-700',
    icon: '🔥',
    description: '즉각 대응 필요'
  },
  {
    id: 'medium' as const,
    title: '중간 관심도',
    color: 'bg-yellow-50 border-yellow-200',
    textColor: 'text-yellow-700',
    badgeColor: 'bg-yellow-100 text-yellow-700',
    icon: '⚡',
    description: '모니터링 권장'
  },
  {
    id: 'low' as const,
    title: '낮은 관심도',
    color: 'bg-slate-50 border-slate-200',
    textColor: 'text-slate-700',
    badgeColor: 'bg-slate-100 text-slate-700',
    icon: '📊',
    description: '참고용'
  }
];

export const ProspectsBoard: React.FC<ProspectsBoardProps> = ({
  prospects,
  onSelectProspect,
  onConvertToCustomer,
  onDismissProspect
}) => {
  // Group prospects by signal strength
  const groupedProspects = useMemo(() => {
    return SIGNAL_COLUMNS.reduce((acc, column) => {
      acc[column.id] = prospects.filter(
        p => p.signalStrength === column.id
      );
      return acc;
    }, {} as Record<string, Prospect[]>);
  }, [prospects]);

  const totalProspects = prospects.length;

  // Format date
  const formatDate = (timestamp: string | number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // Prospect Card Component
  const ProspectCard: React.FC<{ prospect: Prospect }> = ({ prospect }) => {
    return (
      <div
        onClick={() => onSelectProspect(prospect.id)}
        className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5 transition-all cursor-pointer group"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-start gap-2 flex-1">
            <IconBuilding className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-800 text-sm truncate">
                {prospect.companyName}
              </h4>
              {prospect.industry && (
                <p className="text-xs text-slate-500 mt-0.5">{prospect.industry}</p>
              )}
            </div>
          </div>
        </div>

        {/* Source Article */}
        {prospect.sourceArticle && (
          <div className="mb-3 p-2 bg-slate-50 rounded border border-slate-100">
            <div className="flex items-start gap-2">
              <IconNews className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {prospect.sourceArticle.title || '뉴스 기사'}
                </p>
                {prospect.sourceArticle.uri && (
                  <a
                    href={prospect.sourceArticle.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    원문 보기
                    <IconExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {prospect.notes && (
          <div className="mb-3">
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {prospect.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <IconTrendingUp className="w-3 h-3" />
            <span>{formatDate(prospect.detectedAt)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvertToCustomer(prospect.id);
              }}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 transition-all group-hover:scale-105"
            >
              <IconCheck className="w-3 h-3" />
              고객 전환
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismissProspect(prospect.id);
              }}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 hover:border-slate-300 transition-all group-hover:scale-105"
            >
              <IconX className="w-3 h-3" />
              관심 없음
            </button>
          </div>
        </div>

        {/* Website */}
        {prospect.website && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <a
              href={prospect.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-slate-500 hover:text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <IconExternalLink className="w-3 h-3" />
              {prospect.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
      </div>
    );
  };

  if (totalProspects === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <IconSparkles className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          아직 발견된 잠재고객이 없습니다
        </h3>
        <p className="text-sm text-slate-500 mb-4 max-w-md">
          ICP 설정을 완료하면 자동으로 관심 있는 기업들을 찾아드립니다.
          <br />
          설정 메뉴에서 ICP 프로필을 추가해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <IconSparkles className="w-6 h-6 text-blue-600" />
              잠재고객 ({totalProspects})
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              AI가 자동으로 발견한 관심 기업들입니다
            </p>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {SIGNAL_COLUMNS.map(column => {
            const columnProspects = groupedProspects[column.id] || [];

            return (
              <div
                key={column.id}
                className="flex flex-col w-80 flex-shrink-0"
              >
                {/* Column Header */}
                <div className={`${column.color} border rounded-lg p-3 mb-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{column.icon}</span>
                      <h3 className={`font-semibold text-sm ${column.textColor}`}>
                        {column.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${column.badgeColor}`}>
                      {columnProspects.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{column.description}</p>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {columnProspects.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                      <p className="text-xs text-slate-500">
                        해당 신호 강도의 잠재고객이 없습니다
                      </p>
                    </div>
                  ) : (
                    columnProspects.map(prospect => (
                      <ProspectCard key={prospect.id} prospect={prospect} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
