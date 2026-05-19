import type React from "react"
import { useCallback, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import {
  analyzeLostDeal,
  type FollowUpMessage,
  type FollowUpStrategy,
  generateFollowUpMessage,
  generateFollowUpStrategy,
  suggestFollowUpTiming,
} from "../services/followUpService"
import type { Customer, FollowUpAction, FollowUpStrategy as StoredFollowUpStrategy } from "../types"
import {
  IconBrain,
  IconCheck,
  IconClock,
  IconCopy,
  IconLoader,
  IconTrendingUp,
  IconX,
} from "./Icons"

interface FollowUpPanelProps {
  customer: Customer
  isLostDeal: boolean
  onSaveFollowUp: (action: FollowUpAction) => void
}

const extractErrorMessage = (err: unknown): string | undefined => {
  if (err instanceof Error) return err.message
  if (err && typeof err === "object") {
    const nested = (err as { error?: { message?: unknown } }).error?.message
    if (typeof nested === "string") return nested
  }
  return undefined
}

export const FollowUpPanel: React.FC<FollowUpPanelProps> = ({
  customer,
  isLostDeal,
  onSaveFollowUp,
}) => {
  const [strategy, setStrategy] = useState<FollowUpStrategy | null>(null)
  const [message, setMessage] = useState<FollowUpMessage | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timing, setTiming] = useState<{ days: number; date: Date; reason: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Load stored strategy and generate message from it
  const loadStoredStrategy = useCallback(
    async (storedStrategy: StoredFollowUpStrategy) => {
      setIsGenerating(true)
      setError(null)

      try {
        // Use stored strategy directly
        setStrategy(storedStrategy)

        // Calculate timing
        const timingInfo = suggestFollowUpTiming(customer, storedStrategy)
        setTiming(timingInfo)

        // Generate message from stored strategy
        const newMessage = await generateFollowUpMessage(customer, storedStrategy, isLostDeal)
        setMessage(newMessage)
      } catch (err: unknown) {
        console.error("Message generation error:", err)
        setError("메시지 생성에 실패했습니다.")
      } finally {
        setIsGenerating(false)
      }
    },
    [customer, isLostDeal],
  )

  const generateNewStrategy = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      let newStrategy: FollowUpStrategy

      if (isLostDeal && customer.lostReason) {
        newStrategy = await analyzeLostDeal(customer, customer.lostReason)
      } else {
        newStrategy = await generateFollowUpStrategy(customer)
      }

      setStrategy(newStrategy)

      // 타이밍 계산
      const timingInfo = suggestFollowUpTiming(customer, newStrategy)
      setTiming(timingInfo)

      // 메시지 생성
      const newMessage = await generateFollowUpMessage(customer, newStrategy, isLostDeal)
      setMessage(newMessage)
    } catch (err: unknown) {
      console.error("Follow up generation error:", err)

      const message = extractErrorMessage(err)

      if (message?.includes("API key") || message?.includes("INVALID_ARGUMENT")) {
        setError("Gemini API Key가 유효하지 않습니다. 환경 변수를 확인해주세요.")
      } else {
        setError(message || "전략 생성에 실패했습니다. 잠시 후 다시 시도해주세요.")
      }
    } finally {
      setIsGenerating(false)
    }
  }, [customer, isLostDeal])

  useEffect(() => {
    if (customer) {
      // Check if strategy is already stored (from enrichment)
      if (customer.followUpStrategy) {
        loadStoredStrategy(customer.followUpStrategy)
      } else {
        // Fallback: generate on-demand for customers without stored strategy
        generateNewStrategy()
      }
    }
  }, [customer, loadStoredStrategy, generateNewStrategy])

  // Keep generateStrategy for the "regenerate" button
  const generateStrategy = generateNewStrategy

  const handleCopyMessage = () => {
    if (message) {
      const textToCopy = message.subject
        ? `${message.subject}\n\n${message.content}`
        : message.content

      navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveFollowUp = () => {
    if (!message) return

    const action: FollowUpAction = {
      id: Math.random().toString(36).substr(2, 9),
      type:
        message.suggestedChannel === "email"
          ? "email"
          : message.suggestedChannel === "call"
            ? "call"
            : message.suggestedChannel === "meeting"
              ? "meeting"
              : "message",
      content: message.content,
      createdAt: new Date().toISOString(),
      status: "planned",
    }

    onSaveFollowUp(action)
  }

  const getProbabilityColor = (prob: string) => {
    switch (prob) {
      case "high":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "low":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const getProbabilityLabel = (prob: string) => {
    switch (prob) {
      case "high":
        return "높음"
      case "medium":
        return "보통"
      case "low":
        return "낮음"
      default:
        return prob
    }
  }

  if (isGenerating) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
        <IconLoader className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
        <h4 className="text-sm font-semibold text-slate-700 mb-2">AI가 전략을 세우는 중입니다</h4>
        <p className="text-slate-500 text-sm">잠시만 기다려 주세요</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <IconX className="w-5 h-5 text-red-600" />
          <h4 className="text-sm font-semibold text-red-800">전략을 만들지 못했어요</h4>
        </div>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={generateStrategy}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!strategy || !message) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconBrain className="w-8 h-8 text-violet-600" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">아직 후속 전략이 없습니다</h4>
        <p className="text-slate-500 text-sm mb-4">AI가 재접촉 전략을 만들어 드릴까요?</p>
        <button
          onClick={generateStrategy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          전략 만들기
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 전략 요약 */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconBrain className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-800">AI 재접촉 전략</h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getProbabilityColor(strategy.probability)}`}
          >
            성공 가능성 {getProbabilityLabel(strategy.probability)}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="font-semibold text-slate-700">접근 방법</span>
            <p className="text-slate-600 mt-1">{strategy.approach}</p>
          </div>

          <div>
            <span className="font-semibold text-slate-700">메시지 톤</span>
            <p className="text-slate-600 mt-1">{strategy.messageTone}</p>
          </div>

          {strategy.keyPoints.length > 0 && (
            <div>
              <span className="font-semibold text-slate-700">핵심 포인트</span>
              <ul className="list-disc list-inside mt-1 space-y-1 text-slate-600">
                {strategy.keyPoints.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {timing && (
            <div className="flex items-center gap-2 pt-2 border-t border-violet-200">
              <IconClock className="w-4 h-4 text-violet-600" />
              <div>
                <span className="font-semibold text-slate-700">권장 시기 </span>
                <span className="text-slate-600">
                  {timing.days === 0 ? "바로 진행" : `${timing.days}일 후`} (
                  {timing.date.toLocaleDateString("ko-KR")})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 생성된 메시지 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconTrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">생성된 메시지</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
              {message.suggestedChannel === "email"
                ? "이메일"
                : message.suggestedChannel === "call"
                  ? "전화"
                  : message.suggestedChannel === "linkedin"
                    ? "LinkedIn"
                    : "미팅"}
            </span>
            <button
              onClick={handleCopyMessage}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="복사"
            >
              {copied ? (
                <IconCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <IconCopy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {message.subject && (
          <div className="mb-3">
            <span className="text-xs font-semibold text-slate-600">제목:</span>
            <p className="text-sm text-slate-800 mt-1 font-medium">{message.subject}</p>
          </div>
        )}

        <div className="prose prose-sm max-w-none text-sm text-slate-700 leading-relaxed">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        <button
          onClick={handleSaveFollowUp}
          className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <IconCheck className="w-4 h-4" />
          Follow Up 이력에 저장
        </button>
      </div>

      {/* 전략 재생성 버튼 */}
      <button
        onClick={generateStrategy}
        className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
      >
        전략 다시 생성하기
      </button>
    </div>
  )
}
