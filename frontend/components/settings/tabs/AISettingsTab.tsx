import type React from "react"
import { useEffect, useState } from "react"
import { IconCheck, IconLoader } from "../../Icons"
import { card, infoNote, pageDesc, pageTitle, sectionTitle, statusDot } from "../tokens"

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ""

interface ServerAIStatus {
  available: boolean
  serverKeyConfigured: boolean
  model: string
}

export const AISettingsTab: React.FC = () => {
  const [status, setStatus] = useState<ServerAIStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/status`)
        if (!response.ok) throw new Error("status request failed")
        const result = await response.json()
        if (!cancelled && result?.success) {
          setStatus(result.data as ServerAIStatus)
        }
      } catch (error) {
        console.error("Failed to fetch server AI status:", error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const connected = !!status?.serverKeyConfigured

  return (
    <div className="space-y-6">
      <header>
        <h3 className={pageTitle}>AI 모델 연동</h3>
        <p className={pageDesc}>
          데이터 보강, 미팅 요약, 제안서 초안 등 AI 기능에 사용되는 모델 연결 상태입니다.
        </p>
      </header>

      <section className={card}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className={statusDot(connected)} />
            <div className="min-w-0">
              <h4 className={sectionTitle}>Google Gemini</h4>
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                {isLoading
                  ? "상태 확인 중..."
                  : connected
                    ? `연결됨 · ${status?.model ?? "기본 모델"}`
                    : "연결되지 않음"}
              </p>
            </div>
          </div>
          {isLoading ? (
            <IconLoader className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
          ) : connected ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 flex-shrink-0">
              <IconCheck className="w-3 h-3" />
              연동됨
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 flex-shrink-0">
              비활성
            </span>
          )}
        </div>
      </section>

      {!isLoading && !connected && (
        <div className={infoNote}>
          <p className="font-medium text-slate-800 mb-1">서버 환경변수 설정이 필요합니다</p>
          <p>
            서버의{" "}
            <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700">
              GEMINI_API_KEY
            </code>{" "}
            환경변수를 설정하면 AI 기능이 자동으로 활성화됩니다. 자세한 절차는 운영 가이드를
            참고하세요.
          </p>
        </div>
      )}
    </div>
  )
}
