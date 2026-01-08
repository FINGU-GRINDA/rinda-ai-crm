import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Customer, CustomerStatus, FollowUpAction, Proposal } from '../types';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { EnrichmentPanel } from './EnrichmentPanel';
import { FollowUpPanel } from './FollowUpPanel';
import { CustomerFollowUpWidget } from './followup';
import {
  IconX,
  IconGlobe,
  IconArrowRight,
  IconBuilding,
  IconFileText,
  IconBrain,
  IconTrendingUp,
  IconCheck
} from './Icons';
import { KANBAN_COLUMNS } from './KanbanBoard';

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

type DetailPanelTab = 'info' | 'action' | 'history';

interface CustomerDetailPanelProps {
  customer: Customer;
  onClose: () => void;
  onStatusChange: (newStatus: CustomerStatus) => void;
  onEnrichment: () => Promise<void>;
  onSaveProposal: () => void;
  onSaveFollowUp: (action: FollowUpAction) => void;
  isEnriching: boolean;
  enrichmentProgress: { percent: number; message: string };
}

export const CustomerDetailPanel: React.FC<CustomerDetailPanelProps> = ({
  customer,
  onClose,
  onStatusChange,
  onEnrichment,
  onSaveProposal,
  onSaveFollowUp,
  isEnriching,
  enrichmentProgress,
}) => {
  const [detailPanelTab, setDetailPanelTab] = useState<DetailPanelTab>('info');

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300 transform transition-transform">
        {/* Panel Header */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-slate-50 z-10 border-b border-slate-200 px-6 py-5 flex justify-between items-start shadow-sm">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{customer.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <a
                href={`https://${customer.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm hover:text-blue-700 hover:underline flex items-center bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:border-blue-200 transition-colors"
              >
                <IconGlobe className="w-3 h-3 mr-1.5" />
                {customer.website}
                <IconArrowRight className="w-3 h-3 ml-1.5" />
              </a>

              <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-slate-600 font-medium">진행 상태:</span>
                <select
                  value={customer.status}
                  onChange={(e) => onStatusChange(e.target.value as CustomerStatus)}
                  className="text-xs font-semibold bg-transparent border-none rounded py-0 pl-1 pr-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {KANBAN_COLUMNS.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                  <option value="lost">Lost Deal</option>
                </select>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-2 hover:bg-slate-100 transition-colors ml-4 flex-shrink-0"
          >
            <IconX className="w-6 h-6" />
          </button>
        </div>

        {/* Quick Action Buttons - Sticky */}
        <div className="sticky top-[88px] z-10 bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Tooltip text="Gemini Agent가 웹 검색을 통해 기업 정보를 수집하고 세일즈 기회를 포착합니다.">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onEnrichment}
                  loading={isEnriching}
                  loadingText={enrichmentProgress.message}
                  icon={<IconBrain className="w-4 h-4" />}
                  fullWidth
                  aria-label="AI 데이터 분석 실행"
                >
                  데이터 분석 실행
                </Button>
              </Tooltip>

              {isEnriching && enrichmentProgress.percent > 0 && (
                <ProgressBar
                  progress={enrichmentProgress.percent}
                  message={enrichmentProgress.message}
                />
              )}
            </div>

            <Tooltip text={
              !customer?.enrichedData
                ? "먼저 '데이터 분석 실행'을 눌러주세요"
                : "수집된 데이터와 메모를 바탕으로 맞춤형 제안서 초안과 커버 이미지를 생성합니다."
            }>
              <Button
                variant="primary"
                size="md"
                onClick={onSaveProposal}
                icon={<IconFileText className="w-4 h-4" />}
                fullWidth
                disabled={!customer?.enrichedData}
                aria-label="AI 제안서 초안 작성"
                className={!customer?.enrichedData ? 'animate-pulse-subtle' : ''}
              >
                제안서 초안 작성
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-[156px] z-10 bg-white border-b border-slate-200 px-6">
          <div className="flex space-x-1 -mb-px">
            <button
              onClick={() => setDetailPanelTab('info')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                detailPanelTab === 'info'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <IconBuilding className="w-4 h-4" />
                <span>정보</span>
              </div>
            </button>
            <button
              onClick={() => setDetailPanelTab('action')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                detailPanelTab === 'action'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <IconBrain className="w-4 h-4" />
                <span>액션</span>
              </div>
            </button>
            <button
              onClick={() => setDetailPanelTab('history')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                detailPanelTab === 'history'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <IconFileText className="w-4 h-4" />
                <span>이력</span>
                {customer.proposals.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                    detailPanelTab === 'history'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {customer.proposals.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Panel Content - Tab Based */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">

            {/* Info Tab */}
            {detailPanelTab === 'info' && (
              <InfoTabContent customer={customer} isEnriching={isEnriching} />
            )}

            {/* Action Tab */}
            {detailPanelTab === 'action' && (
              <ActionTabContent
                customer={customer}
                isEnriching={isEnriching}
                onEnrichment={onEnrichment}
                onSaveFollowUp={onSaveFollowUp}
              />
            )}

            {/* History Tab */}
            {detailPanelTab === 'history' && (
              <HistoryTabContent customer={customer} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Info Tab Content
const InfoTabContent: React.FC<{
  customer: Customer;
  isEnriching: boolean;
}> = ({ customer, isEnriching }) => (
  <div className="space-y-6">
    {/* Basic Info Card */}
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
        <IconBuilding className="w-4 h-4 mr-2 text-blue-600" />
        기본 정보
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className="text-xs font-medium text-slate-600">산업 분야</span>
          <p className="text-sm font-semibold text-slate-800 mt-1">{customer.industry}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-600">웹사이트</span>
          <a
            href={`https://${customer.website}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 mt-1"
          >
            {customer.website}
            <IconArrowRight className="w-3 h-3" />
          </a>
        </div>
        <div className="sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">진행 상태</span>
          <div className="mt-1">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              customer.status === 'new' ? 'bg-slate-100 text-slate-700' :
              customer.status === 'contact' ? 'bg-blue-100 text-blue-700' :
              customer.status === 'negotiation' ? 'bg-indigo-100 text-indigo-700' :
              customer.status === 'won' ? 'bg-emerald-100 text-emerald-700' :
              'bg-red-100 text-red-700'
            }`}>
              {KANBAN_COLUMNS.find(c => c.id === customer.status)?.title || customer.status}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Internal Notes */}
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center">
          <IconFileText className="w-4 h-4 mr-2 text-blue-600" />
          메모장
        </h3>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center border border-emerald-200 shadow-sm">
          <IconCheck className="w-3 h-3 mr-1.5" />
          자동으로 저장돼요
        </span>
      </div>
      <textarea
        className="w-full text-sm text-slate-700 bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-4 border-2 border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none placeholder:text-slate-400"
        rows={5}
        value={customer.notes}
        readOnly
        placeholder="고객과의 대화 내용, 특이사항, 다음 미팅 준비사항 등을 자유롭게 적어보세요..."
      />
    </div>

    {/* Enrichment Data */}
    {customer.enrichedData ? (
      <EnrichmentPanel
        data={customer.enrichedData}
        isLoading={isEnriching}
        lastEnrichedAt={customer.lastEnrichedAt}
      />
    ) : (
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconBrain className="w-8 h-8 text-blue-600" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">아직 분석된 정보가 없어요</h4>
        <p className="text-slate-500 text-sm leading-relaxed">
          위의 '데이터 분석 실행' 버튼을 눌러보세요.<br/>
          AI가 회사 정보를 찾아 영업 기회를 찾아드려요.
        </p>
      </div>
    )}
  </div>
);

// Action Tab Content
const ActionTabContent: React.FC<{
  customer: Customer;
  isEnriching: boolean;
  onEnrichment: () => Promise<void>;
  onSaveFollowUp: (action: FollowUpAction) => void;
}> = ({ customer, isEnriching, onEnrichment, onSaveFollowUp }) => (
  <div className="space-y-6">
    {/* AI Analysis Results */}
    {customer.enrichedData ? (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
          <IconBrain className="w-4 h-4 mr-2 text-indigo-600" />
          AI 분석 결과
        </h3>
        <EnrichmentPanel
          data={customer.enrichedData}
          isLoading={isEnriching}
          lastEnrichedAt={customer.lastEnrichedAt}
        />
      </div>
    ) : (
      <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconBrain className="w-8 h-8 text-indigo-600" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">AI 분석이 필요해요</h4>
        <p className="text-slate-500 text-sm leading-relaxed mb-4">
          먼저 AI 분석을 실행하여 고객 정보를 수집해주세요.
        </p>
        <button
          onClick={onEnrichment}
          disabled={isEnriching}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEnriching ? '분석 중...' : 'AI 분석 실행하기'}
        </button>
      </div>
    )}

    {/* Customer Follow-up Schedule Widget */}
    <CustomerFollowUpWidget
      customer={customer}
      onFollowUpChange={() => {
        // Refresh to update header badge count
      }}
    />

    {/* Follow Up Strategy */}
    {(customer.status === 'lost' || customer.status === 'new') && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-3 flex items-center">
          <IconTrendingUp className="w-4 h-4 mr-2 text-blue-600" />
          AI Follow Up 전략
        </h3>
        <FollowUpPanel
          customer={customer}
          isLostDeal={customer.status === 'lost'}
          onSaveFollowUp={onSaveFollowUp}
        />
      </div>
    )}
  </div>
);

// History Tab Content
const HistoryTabContent: React.FC<{
  customer: Customer;
}> = ({ customer }) => (
  <div className="space-y-6">
    {/* Proposals List */}
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-3 flex items-center">
        <IconFileText className="w-4 h-4 mr-2 text-emerald-600" />
        작성한 제안서
        {customer.proposals.length > 0 && (
          <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">
            {customer.proposals.length}개
          </span>
        )}
      </h3>
      <div className="space-y-3">
        {customer.proposals.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
            <IconFileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium mb-1">아직 작성한 제안서가 없어요.</p>
            <p className="text-xs text-slate-400">위의 '제안서 초안 작성' 버튼을 눌러 AI가 만들어드릴게요.</p>
          </div>
        ) : (
          customer.proposals.map(proposal => (
            <div
              key={proposal.id}
              className="bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
            >
              <div className="flex">
                {proposal.imageUrl && (
                  <div className="w-24 h-24 bg-slate-100 flex-shrink-0 overflow-hidden">
                    <img src={proposal.imageUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 text-sm flex-1 truncate">{proposal.title}</h4>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded ml-2 flex-shrink-0">
                      {new Date(proposal.createdAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    <ReactMarkdown allowedElements={['p']}>{proposal.content.substring(0, 150)}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    {/* Follow Up History */}
    {customer.followUpHistory && customer.followUpHistory.length > 0 && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-3 flex items-center">
          <IconTrendingUp className="w-4 h-4 mr-2 text-emerald-600" />
          Follow Up 이력
          <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">
            {customer.followUpHistory.length}개
          </span>
        </h3>
        <div className="space-y-3">
          {customer.followUpHistory.map((action, idx) => (
            <div
              key={action.id || idx}
              className="bg-slate-50 border border-slate-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    action.type === 'email' ? 'bg-blue-100 text-blue-700' :
                    action.type === 'call' ? 'bg-purple-100 text-purple-700' :
                    action.type === 'meeting' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {action.type === 'email' ? '이메일' :
                     action.type === 'call' ? '전화' :
                     action.type === 'meeting' ? '미팅' : '메시지'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(action.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  action.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  action.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {action.status === 'completed' ? '완료' :
                   action.status === 'planned' ? '예정' : '대기'}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-2">{action.content}</p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default CustomerDetailPanel;
