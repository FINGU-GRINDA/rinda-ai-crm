import type React from "react"
import { useState } from "react"
import { Input, Modal, Select } from "../ui"

interface AddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; website: string; industry: string }) => void
}

const INDUSTRIES = [
  "미분류",
  "SaaS",
  "재생 에너지",
  "유통/커머스",
  "제조업",
  "금융",
  "헬스케어",
] as const

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [industry, setIndustry] = useState<string>("미분류")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, website, industry })
    setName("")
    setWebsite("")
    setIndustry("미분류")
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="새 고객 추가"
      description="영업 파이프라인에 추가할 회사 정보를 입력해 주세요"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            form="add-customer-form"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
          >
            추가하기
          </button>
        </>
      }
    >
      <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="회사명 *"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 삼성전자"
        />
        <Input
          label="웹사이트 *"
          required
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="예: samsung.com"
        />
        <Select label="산업 분야" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {INDUSTRIES.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  )
}

export default AddCustomerModal
