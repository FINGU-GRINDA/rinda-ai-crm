import type React from "react"
import { useEffect, useState } from "react"
import type { Customer, FollowUpType, ScheduledFollowUp } from "../../types"
import { Button } from "../Button"
import { IconBuilding, IconCalendar, IconCheck, IconMail, IconMessageSquare, IconX } from "../Icons"

interface FollowUpCompletionModalProps {
  followUp: ScheduledFollowUp
  customer: Customer | undefined
  onComplete: (note: string) => void
  onCancel: () => void
  isOpen: boolean
}

const getTypeLabel = (type: FollowUpType): string => {
  switch (type) {
    case "email":
      return "이메일"
    case "call":
      return "전화"
    case "meeting":
      return "미팅"
    case "message":
      return "메시지"
    default:
      return type
  }
}

const getTypeIcon = (type: FollowUpType) => {
  switch (type) {
    case "email":
      return <IconMail className="w-4 h-4 text-blue-600" />
    case "call":
      return <IconMessageSquare className="w-4 h-4 text-emerald-600" />
    case "meeting":
      return <IconCalendar className="w-4 h-4 text-amber-600" />
    case "message":
      return <IconMessageSquare className="w-4 h-4 text-slate-600" />
    default:
      return <IconMail className="w-4 h-4 text-slate-600" />
  }
}

export const FollowUpCompletionModal: React.FC<FollowUpCompletionModalProps> = ({
  followUp,
  customer,
  onComplete,
  onCancel,
  isOpen,
}) => {
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNote("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onCancel])

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      await onComplete(note)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <IconCheck className="w-5 h-5 text-emerald-600" />
            후속 액션 완료 처리
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Customer Info Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <IconBuilding className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">
                  {customer?.name || "알 수 없는 고객"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {getTypeIcon(followUp.type)}
                  <span className="text-sm text-slate-600">{getTypeLabel(followUp.type)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      followUp.priority === "high"
                        ? "bg-red-50 text-red-700"
                        : followUp.priority === "medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {followUp.priority === "high"
                      ? "높음"
                      : followUp.priority === "medium"
                        ? "보통"
                        : "낮음"}
                  </span>
                </div>
              </div>
            </div>

            {/* Follow-up Reason */}
            {followUp.reason && (
              <p className="text-sm text-slate-600 mt-3 pl-[52px]">{followUp.reason}</p>
            )}
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              완료 메모 <span className="text-slate-400 font-normal">(선택사항)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
              rows={4}
              placeholder="통화 결과, 다음 액션 등을 기록하세요..."
            />
            <p className="text-xs text-slate-400 mt-1">이 메모는 고객 히스토리에 저장됩니다.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <Button variant="tertiary" onClick={onCancel} disabled={isSubmitting} fullWidth>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            loading={isSubmitting}
            loadingText="처리 중..."
            fullWidth
            icon={<IconCheck className="w-4 h-4" />}
          >
            완료 처리
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FollowUpCompletionModal
