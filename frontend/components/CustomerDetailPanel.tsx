import type React from "react"
import { useCallback, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import { apiClient } from "../src/services/apiClient"
import { transformApiMeeting } from "../src/utils/apiTransformers"
import { isSuccessListResponse } from "../src/utils/typeGuards"
import { aiAccentText } from "../styles/design-tokens"
import type { Customer, CustomerStatus, FollowUpAction, MeetingSummary, Proposal } from "../types"
import { Button } from "./Button"
import { EnrichmentPanel } from "./EnrichmentPanel"
import { FollowUpPanel } from "./FollowUpPanel"
import { CustomerFollowUpWidget } from "./followup"
import {
  IconArrowRight,
  IconBrain,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconClock,
  IconFileText,
  IconGlobe,
  IconMessageSquare,
  IconRefresh,
  IconTrendingUp,
  IconX,
} from "./Icons"
import { KANBAN_COLUMNS } from "./KanbanBoard"
import { MeetingDetailModal } from "./MeetingDetailModal"
import { ProgressBar } from "./ProgressBar"
import { ProposalViewModal } from "./ProposalViewModal"
import { Card } from "./ui/Card"
import { EmptyState } from "./ui/EmptyState"
import { StatusBadge } from "./ui/StatusBadge"

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

type DetailPanelTab = "info" | "action" | "history" | "meetings"

interface CustomerDetailPanelProps {
  customer: Customer
  onClose: () => void
  onStatusChange: (newStatus: CustomerStatus) => void
  onEnrichment: () => Promise<void>
  onSaveProposal: () => void
  onSaveFollowUp: (action: FollowUpAction) => void
  isEnriching: boolean
  enrichmentProgress: { percent: number; message: string }
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
  const [detailPanelTab, setDetailPanelTab] = useState<DetailPanelTab>("info")
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [meetings, setMeetings] = useState<MeetingSummary[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null)

  // Fetch meetings when tab is selected
  const fetchMeetings = useCallback(async () => {
    if (!customer.id) return
    setLoadingMeetings(true)
    try {
      const response = await apiClient.getCustomerMeetings(customer.id)
      if (isSuccessListResponse(response)) {
        setMeetings(response.data.map(transformApiMeeting))
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error)
    } finally {
      setLoadingMeetings(false)
    }
  }, [customer.id])

  // Fetch on tab selection (lazy loading)
  useEffect(() => {
    if (detailPanelTab === "meetings" && meetings.length === 0) {
      fetchMeetings()
    }
  }, [detailPanelTab, fetchMeetings, meetings.length])

  const handleDeleteMeeting = useCallback(async (meetingId: string) => {
    try {
      await apiClient.deleteMeeting(meetingId)
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId))
      setSelectedMeeting(null)
    } catch (error) {
      console.error("Failed to delete meeting:", error)
    }
  }, [])

  return (
    <>
      {/* Proposal View Modal */}
      {selectedProposal && (
        <ProposalViewModal
          proposal={selectedProposal}
          customerName={customer.name}
          isOpen={true}
          onClose={() => setSelectedProposal(null)}
        />
      )}

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          customerName={customer.name}
          isOpen={true}
          onClose={() => setSelectedMeeting(null)}
          onDelete={handleDeleteMeeting}
        />
      )}

      {/* Main Panel */}
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>

        {/* Panel */}
        <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300 transform transition-transform">
          {/* Panel Header */}
          <div className="sticky top-0 bg-white z-10 border-b border-slate-200 px-6 py-5 flex justify-between items-start shadow-sm">
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
                  <span className="text-xs text-slate-600 font-medium">진행 상태</span>
                  <select
                    value={customer.status}
                    onChange={(e) => onStatusChange(e.target.value as CustomerStatus)}
                    className="text-xs font-semibold bg-transparent border-none rounded py-0 pl-1 pr-4 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    aria-label="진행 상태 변경"
                  >
                    {KANBAN_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
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
                <Tooltip text="AI가 웹에서 회사 정보를 찾아 영업 기회를 정리해 드립니다.">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={onEnrichment}
                    loading={isEnriching}
                    loadingText={enrichmentProgress.message}
                    icon={<IconBrain className="w-4 h-4" />}
                    fullWidth
                    aria-label="회사 정보 자동 채우기"
                  >
                    회사 정보 자동 채우기
                  </Button>
                </Tooltip>

                {isEnriching && enrichmentProgress.percent > 0 && (
                  <ProgressBar
                    progress={enrichmentProgress.percent}
                    message={enrichmentProgress.message}
                  />
                )}
              </div>

              <Tooltip
                text={
                  !customer?.enrichedData
                    ? "먼저 회사 정보를 자동으로 채워 주세요"
                    : "수집된 정보와 메모를 바탕으로 AI가 제안서 초안과 표지 이미지를 만들어 드립니다"
                }
              >
                <Button
                  variant="primary"
                  size="md"
                  onClick={onSaveProposal}
                  icon={<IconFileText className="w-4 h-4" />}
                  fullWidth
                  disabled={!customer?.enrichedData}
                  aria-label="AI 제안서 초안 작성"
                  className={!customer?.enrichedData ? "animate-pulse-subtle" : ""}
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
                onClick={() => setDetailPanelTab("info")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  detailPanelTab === "info"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconBuilding className="w-4 h-4" />
                  <span>정보</span>
                </div>
              </button>
              <button
                onClick={() => setDetailPanelTab("action")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  detailPanelTab === "action"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconBrain className="w-4 h-4" />
                  <span>액션</span>
                </div>
              </button>
              <button
                onClick={() => setDetailPanelTab("history")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  detailPanelTab === "history"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconFileText className="w-4 h-4" />
                  <span>이력</span>
                  {customer.proposals.length > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        detailPanelTab === "history"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {customer.proposals.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setDetailPanelTab("meetings")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  detailPanelTab === "meetings"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconMessageSquare className="w-4 h-4" />
                  <span>미팅</span>
                  {meetings.length > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        detailPanelTab === "meetings"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {meetings.length}
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
              {detailPanelTab === "info" && (
                <InfoTabContent customer={customer} isEnriching={isEnriching} />
              )}

              {/* Action Tab */}
              {detailPanelTab === "action" && (
                <ActionTabContent
                  customer={customer}
                  isEnriching={isEnriching}
                  onEnrichment={onEnrichment}
                  onSaveFollowUp={onSaveFollowUp}
                />
              )}

              {/* History Tab */}
              {detailPanelTab === "history" && (
                <HistoryTabContent customer={customer} onSelectProposal={setSelectedProposal} />
              )}

              {/* Meetings Tab */}
              {detailPanelTab === "meetings" && (
                <MeetingTabContent
                  customer={customer}
                  meetings={meetings}
                  loading={loadingMeetings}
                  onMeetingClick={setSelectedMeeting}
                  onRefresh={fetchMeetings}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Info Tab Content
const InfoTabContent: React.FC<{
  customer: Customer
  isEnriching: boolean
}> = ({ customer, isEnriching }) => (
  <div className="space-y-6">
    {/* Basic Info Card */}
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
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
            <StatusBadge kind="status" value={customer.status} />
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
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center border border-emerald-200">
          <IconCheck className="w-3 h-3 mr-1.5" />
          자동으로 저장됐어요
        </span>
      </div>
      <textarea
        className="w-full text-sm text-slate-700 bg-slate-50 rounded-lg p-4 border-2 border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none placeholder:text-slate-400"
        rows={5}
        value={customer.notes}
        readOnly
        placeholder="고객과의 대화 내용, 특이 사항, 다음 미팅 준비 사항을 자유롭게 작성해 보세요"
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
      <EmptyState
        size="lg"
        icon={<IconBrain className="w-8 h-8" />}
        title="아직 수집된 회사 정보가 없습니다"
        description={
          <>
            위의 ‘회사 정보 자동 채우기’ 버튼을 눌러 보세요.
            <br />
            AI가 회사 정보를 찾아 영업 기회를 정리해 드립니다.
          </>
        }
      />
    )}
  </div>
)

// Action Tab Content
const ActionTabContent: React.FC<{
  customer: Customer
  isEnriching: boolean
  onEnrichment: () => Promise<void>
  onSaveFollowUp: (action: FollowUpAction) => void
}> = ({ customer, isEnriching, onEnrichment, onSaveFollowUp }) => (
  <div className="space-y-6">
    {/* AI Analysis Results */}
    {customer.enrichedData ? (
      <Card tone="ai" padding="lg">
        <h3 className={`text-sm font-bold mb-4 flex items-center ${aiAccentText}`}>
          <IconBrain className="w-4 h-4 mr-2" />
          AI 분석 결과
        </h3>
        <EnrichmentPanel
          data={customer.enrichedData}
          isLoading={isEnriching}
          lastEnrichedAt={customer.lastEnrichedAt}
        />
      </Card>
    ) : (
      <EmptyState
        size="lg"
        icon={<IconBrain className="w-8 h-8" />}
        title="AI 분석을 시작해 보세요"
        description="먼저 회사 정보를 자동으로 채우면, AI가 영업 기회를 정리해 드립니다."
        action={
          <button
            onClick={onEnrichment}
            disabled={isEnriching}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnriching ? "정보를 채우는 중입니다…" : "회사 정보 자동 채우기"}
          </button>
        }
      />
    )}

    {/* Customer Follow-up Schedule Widget */}
    <CustomerFollowUpWidget
      customer={customer}
      onFollowUpChange={() => {
        // Refresh to update header badge count
      }}
    />

    {/* Follow Up Strategy */}
    {(customer.status === "lost" || customer.status === "new") && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-3 flex items-center">
          <IconTrendingUp className="w-4 h-4 mr-2 text-blue-600" />
          AI 후속 액션 전략
        </h3>
        <FollowUpPanel
          customer={customer}
          isLostDeal={customer.status === "lost"}
          onSaveFollowUp={onSaveFollowUp}
        />
      </div>
    )}
  </div>
)

// History Tab Content
const HistoryTabContent: React.FC<{
  customer: Customer
  onSelectProposal: (proposal: Proposal) => void
}> = ({ customer, onSelectProposal }) => (
  <div className="space-y-6">
    {/* Proposals List */}
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-3 flex items-center">
        <IconFileText className="w-4 h-4 mr-2 text-blue-600" />
        작성한 제안서
        {customer.proposals.length > 0 && (
          <span className="ml-2 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold">
            {customer.proposals.length}건
          </span>
        )}
      </h3>
      <div className="space-y-3">
        {customer.proposals.length === 0 ? (
          <EmptyState
            icon={<IconFileText className="w-8 h-8" />}
            title="아직 작성한 제안서가 없습니다"
            description="위의 ‘제안서 초안 작성’ 버튼을 누르면 AI가 만들어 드립니다"
          />
        ) : (
          customer.proposals.map((proposal) => (
            <div
              key={proposal.id}
              onClick={() => onSelectProposal(proposal)}
              className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
            >
              <div className="flex">
                {proposal.imageUrl && (
                  <div className="w-24 h-24 bg-slate-100 flex-shrink-0 overflow-hidden">
                    <img
                      src={proposal.imageUrl}
                      alt="Cover"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 text-sm flex-1 truncate">
                      {proposal.title}
                    </h4>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded ml-2 flex-shrink-0">
                      {new Date(proposal.createdAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    <ReactMarkdown allowedElements={["p"]}>
                      {proposal.content.substring(0, 150)}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    <span>전체 보기</span>
                    <IconArrowRight className="w-3 h-3" />
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
          후속 액션 이력
          <span className="ml-2 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold">
            {customer.followUpHistory.length}건
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
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      action.type === "email"
                        ? "bg-blue-50 text-blue-700"
                        : action.type === "call"
                          ? "bg-emerald-50 text-emerald-700"
                          : action.type === "meeting"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {action.type === "email"
                      ? "이메일"
                      : action.type === "call"
                        ? "전화"
                        : action.type === "meeting"
                          ? "미팅"
                          : "메시지"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(action.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    action.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : action.status === "planned"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {action.status === "completed"
                    ? "완료"
                    : action.status === "planned"
                      ? "예정"
                      : "대기"}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-2">{action.content}</p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)

// Meeting Tab Content
const MeetingTabContent: React.FC<{
  customer: Customer
  meetings: MeetingSummary[]
  loading: boolean
  onMeetingClick: (meeting: MeetingSummary) => void
  onRefresh: () => void
}> = ({ customer, meetings, loading, onMeetingClick, onRefresh }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">
          <IconMessageSquare className="w-8 h-8 text-blue-600" />
        </div>
        <span className="ml-3 text-slate-600 text-sm">미팅 기록을 불러오는 중입니다</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center">
          <IconMessageSquare className="w-4 h-4 mr-2 text-blue-600" />
          미팅 이력
          {meetings.length > 0 && (
            <span className="ml-2 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold">
              {meetings.length}건
            </span>
          )}
        </h3>
        <button
          onClick={onRefresh}
          className="text-slate-500 hover:text-slate-700 p-1 hover:bg-slate-100 rounded transition-colors"
          aria-label="새로고침"
        >
          <IconRefresh className="w-4 h-4" />
        </button>
      </div>

      {/* Meeting List */}
      {meetings.length === 0 ? (
        <EmptyState
          icon={<IconMessageSquare className="w-8 h-8" />}
          title="아직 기록된 미팅이 없습니다"
          description="미팅 녹음 기능으로 첫 미팅을 기록해 보세요"
        />
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => onMeetingClick(meeting)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Meeting Card Component
const MeetingCard: React.FC<{
  meeting: MeetingSummary
  onClick: () => void
}> = ({ meeting, onClick }) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    return `${mins}분`
  }

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
            {meeting.title}
          </h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <IconCalendar className="w-3 h-3" />
              {formatDate(new Date(meeting.meetingDate).getTime())}
            </span>
            {meeting.duration && (
              <span className="flex items-center gap-1">
                <IconClock className="w-3 h-3" />
                {formatDuration(meeting.duration)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Preview */}
      {meeting.summary && (
        <p className="text-sm text-slate-600 line-clamp-2 mb-3 leading-relaxed">
          {meeting.summary}
        </p>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-3 flex-wrap">
        {meeting.keyDiscussions && meeting.keyDiscussions.length > 0 && (
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full flex items-center gap-1">
            <IconMessageSquare className="w-3 h-3" />
            논의 {meeting.keyDiscussions.length}
          </span>
        )}
        {meeting.actionItems && meeting.actionItems.length > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
            <IconCheck className="w-3 h-3" />
            액션 {meeting.actionItems.length}
          </span>
        )}
        {meeting.nextSteps && meeting.nextSteps.length > 0 && (
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1">
            <IconArrowRight className="w-3 h-3" />
            다음 {meeting.nextSteps.length}
          </span>
        )}
      </div>

      {/* View More Indicator */}
      <div className="mt-3 text-xs text-blue-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
        <span>자세히 보기</span>
        <IconArrowRight className="w-3 h-3" />
      </div>
    </div>
  )
}

export default CustomerDetailPanel
