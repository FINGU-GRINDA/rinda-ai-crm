import type React from "react"
import { useState } from "react"
import type { MeetingSummary } from "../types"
import {
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconClock,
  IconMessageSquare,
  IconTrash,
  IconX,
} from "./Icons"

interface MeetingDetailModalProps {
  meeting: MeetingSummary | null
  customerName: string
  isOpen: boolean
  onClose: () => void
  onDelete?: (meetingId: string) => void
}

export const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({
  meeting,
  customerName,
  isOpen,
  onClose,
  onDelete,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!isOpen || !meeting) return null

  const formatDate = (timestamp: string | number) => {
    return new Date(timestamp).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}분 ${secs}초`
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(meeting.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconMessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{meeting.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {customerName} • {formatDate(meeting.meetingDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-slate-600 pb-4 border-b">
            <span className="flex items-center gap-1.5">
              <IconCalendar className="w-4 h-4" />
              {formatDate(meeting.meetingDate)}
            </span>
            {meeting.duration && (
              <span className="flex items-center gap-1.5">
                <IconClock className="w-4 h-4" />
                {formatDuration(meeting.duration)}
              </span>
            )}
          </div>

          {/* Summary */}
          {meeting.summary && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                  <IconMessageSquare className="w-3.5 h-3.5 text-blue-600" />
                </div>
                미팅 요약
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">{meeting.summary}</p>
            </div>
          )}

          {/* Key Discussions */}
          {meeting.keyDiscussions && meeting.keyDiscussions.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center">
                  <IconMessageSquare className="w-3.5 h-3.5 text-slate-600" />
                </div>
                핵심 논의사항
                <span className="ml-1 bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {meeting.keyDiscussions.length}
                </span>
              </h4>
              <ul className="space-y-2">
                {meeting.keyDiscussions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 font-medium flex-shrink-0">{i + 1}.</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {meeting.actionItems && meeting.actionItems.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-100 rounded flex items-center justify-center">
                  <IconCheck className="w-3.5 h-3.5 text-amber-600" />
                </div>
                액션 아이템
                <span className="ml-1 bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {meeting.actionItems.length}
                </span>
              </h4>
              <ul className="space-y-2">
                {meeting.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <IconCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Customer Needs */}
          {meeting.customerNeeds && meeting.customerNeeds.length > 0 && (
            <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl">
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-violet-100 rounded flex items-center justify-center">
                  <IconBriefcase className="w-3.5 h-3.5 text-violet-600" />
                </div>
                고객 니즈
              </h4>
              <ul className="space-y-2">
                {meeting.customerNeeds.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Budget & Timeline */}
          {(meeting.budgetMentions || meeting.timelineMentions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meeting.budgetMentions && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">예산 언급</h4>
                  <p className="text-sm text-slate-700">{meeting.budgetMentions}</p>
                </div>
              )}
              {meeting.timelineMentions && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">일정 언급</h4>
                  <p className="text-sm text-slate-700">{meeting.timelineMentions}</p>
                </div>
              )}
            </div>
          )}

          {/* Next Steps */}
          {meeting.nextSteps && meeting.nextSteps.length > 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center">
                  <IconArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                다음 단계
                <span className="ml-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {meeting.nextSteps.length}
                </span>
              </h4>
              <ul className="space-y-2">
                {meeting.nextSteps.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <IconArrowRight className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcription (Collapsed by default) */}
          {meeting.transcription && (
            <details className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <summary className="font-semibold text-slate-800 cursor-pointer hover:text-slate-900">
                전체 녹취록 보기
              </summary>
              <div className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {meeting.transcription}
              </div>
            </details>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-500">
            생성: {new Date(meeting.createdAt).toLocaleDateString("ko-KR")}
          </div>

          {onDelete && (
            <div className="relative">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-all"
                >
                  <IconTrash className="w-4 h-4" />
                  <span>삭제</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 font-medium mr-2">
                    정말 삭제하시겠습니까?
                  </span>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeetingDetailModal
