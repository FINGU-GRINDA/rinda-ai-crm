import type React from "react"
import { useEffect, useState } from "react"
import { createManualFollowUp } from "../../services/autoFollowUpService"
import type { Customer, FollowUpPriority, FollowUpType, ScheduledFollowUp } from "../../types"
import { Button } from "../Button"
import { IconCalendar, IconClock, IconMail, IconMessageSquare, IconPlus, IconX } from "../Icons"

interface FollowUpFormModalProps {
  customer: Customer
  onSubmit: (followUp: ScheduledFollowUp) => void
  onClose: () => void
  isOpen: boolean
}

const followUpTypes: { value: FollowUpType; label: string; icon: React.ReactNode }[] = [
  { value: "email", label: "이메일", icon: <IconMail className="w-4 h-4" /> },
  { value: "call", label: "전화", icon: <IconMessageSquare className="w-4 h-4" /> },
  { value: "meeting", label: "미팅", icon: <IconCalendar className="w-4 h-4" /> },
  { value: "message", label: "메시지", icon: <IconMessageSquare className="w-4 h-4" /> },
]

const priorities: { value: FollowUpPriority; label: string; color: string }[] = [
  { value: "high", label: "높음", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "medium", label: "보통", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "low", label: "낮음", color: "bg-slate-100 text-slate-700 border-slate-200" },
]

export const FollowUpFormModal: React.FC<FollowUpFormModalProps> = ({
  customer,
  onSubmit,
  onClose,
  isOpen,
}) => {
  const [type, setType] = useState<FollowUpType>("email")
  const [priority, setPriority] = useState<FollowUpPriority>("medium")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [reason, setReason] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set default date to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setScheduledDate(tomorrow.toISOString().split("T")[0])
      setScheduledTime("09:00")
      setType("email")
      setPriority("medium")
      setReason("")
      setContent("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!scheduledDate || !reason.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Combine date and time
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).getTime()

      const followUp = createManualFollowUp(customer.id, {
        scheduledFor,
        type,
        content: content.trim() || undefined,
        priority,
        reason: reason.trim(),
      })

      onSubmit(followUp)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <IconPlus className="w-5 h-5 text-blue-600" />새 Follow-up 스케줄
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer Info */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <span className="text-blue-600 font-medium">고객:</span>{" "}
            <span className="text-slate-800 font-semibold">{customer.name}</span>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Follow-up 유형</label>
            <div className="grid grid-cols-4 gap-2">
              {followUpTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                    type === t.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {t.icon}
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">시간</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">우선순위</label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    priority === p.value
                      ? `${p.color} border-current`
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Follow-up 이유 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 제안서 검토 후 의견 확인"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              required
            />
          </div>

          {/* Content (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              메모 <span className="text-slate-400 font-normal">(선택사항)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="참고할 내용이 있다면 입력하세요..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="tertiary"
              onClick={onClose}
              disabled={isSubmitting}
              fullWidth
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              loadingText="생성 중..."
              fullWidth
              icon={<IconClock className="w-4 h-4" />}
            >
              스케줄 등록
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FollowUpFormModal
