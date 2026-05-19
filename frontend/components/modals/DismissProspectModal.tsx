import type React from "react"
import { useState } from "react"
import type { Prospect } from "../../types"
import { Modal, Textarea } from "../ui"

interface DismissProspectModalProps {
  isOpen: boolean
  prospect: Prospect | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}

const DISMISS_REASONS = [
  "잘못된 산업",
  "회사 규모가 너무 작음",
  "회사 규모가 너무 큼",
  "목표 시장 외",
  "경쟁사",
  "중복된 리드",
  "신호 품질 낮음",
  "기타",
]

export const DismissProspectModal: React.FC<DismissProspectModalProps> = ({
  isOpen,
  prospect,
  onConfirm,
  onCancel,
}) => {
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  if (!prospect) return null

  const handleConfirm = () => {
    const reason = selectedReason === "기타" ? customReason : selectedReason
    if (!reason.trim()) return
    onConfirm(reason.trim())
    setSelectedReason("")
    setCustomReason("")
  }

  const handleCancel = () => {
    setSelectedReason("")
    setCustomReason("")
    onCancel()
  }

  const isOtherSelected = selectedReason === "기타"
  const canSubmit = selectedReason && (!isOtherSelected || customReason.trim())

  return (
    <Modal
      open={isOpen}
      onClose={handleCancel}
      title="잠재 고객에서 제외"
      description={
        <>
          <span className="font-semibold text-slate-800">{prospect.companyName}</span>을(를) 잠재
          고객 목록에서 제외할까요?
        </>
      }
      size="md"
      footer={
        <>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg active:scale-95"
          >
            제외하기
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            제외 사유 <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {DISMISS_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="dismiss-reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-slate-700">{reason}</span>
              </label>
            ))}
          </div>
        </div>

        {isOtherSelected && (
          <Textarea
            label="상세 사유"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="구체적인 사유를 입력해 주세요"
            rows={3}
            className="animate-in fade-in duration-200"
          />
        )}
      </div>
    </Modal>
  )
}

export default DismissProspectModal
