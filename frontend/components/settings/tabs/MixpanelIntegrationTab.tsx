import type React from "react"
import { useEffect, useState } from "react"
import { IconCheck, IconExternalLink, IconLoader, IconRefresh, IconX } from "../../Icons"

interface MixpanelSettings {
  isEnabled: boolean
  trackedEvents: string[]
  autoCreateProspect: boolean
  defaultSignalStrength: "high" | "medium" | "low"
  enrichWithAI: boolean
  syncInterval: "hourly" | "every_4_hours" | "daily"
  lastSyncAt: string | null
}

interface ConnectionStatus {
  data: {
    configured: boolean
    authType: "project_secret" | "service_account" | null
    projectId: string | null
    message: string
  }
  success: boolean
}

export interface MixpanelFormState {
  isDirty: boolean
  isSaving: boolean
  onSave: () => Promise<void>
  onReset: () => void
}

interface MixpanelIntegrationTabProps {
  onSettingsChange?: () => void
  onFormStateChange?: (state: MixpanelFormState | null) => void
}

const API_BASE = "http://localhost:3001/api"

const DEFAULT_SETTINGS: MixpanelSettings = {
  isEnabled: false,
  trackedEvents: ["$signup", "sign_up", "user_signup", "registration", "account_created"],
  autoCreateProspect: true,
  defaultSignalStrength: "medium",
  enrichWithAI: true,
  syncInterval: "hourly",
  lastSyncAt: null,
}

export const MixpanelIntegrationTab: React.FC<MixpanelIntegrationTabProps> = ({
  onSettingsChange,
  onFormStateChange,
}) => {
  // Form state (local edits)
  const [formData, setFormData] = useState<MixpanelSettings>(DEFAULT_SETTINGS)
  // Server state (last saved)
  const [originalData, setOriginalData] = useState<MixpanelSettings>(DEFAULT_SETTINGS)
  // Track unsaved changes
  const [isDirty, setIsDirty] = useState(false)

  // Connection status from backend (env var check)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [newEvent, setNewEvent] = useState("")

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
    fetchConnectionStatus()
  }, [fetchConnectionStatus, fetchSettings])

  // Check if form is dirty whenever formData changes
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData)
    setIsDirty(hasChanges)
  }, [formData, originalData])

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/mixpanel/settings`)
      if (response.ok) {
        const data = await response.json()
        const mergedData = {
          ...DEFAULT_SETTINGS,
          ...data,
          trackedEvents: data.trackedEvents || DEFAULT_SETTINGS.trackedEvents,
        }
        setFormData(mergedData)
        setOriginalData(mergedData)
      }
    } catch (error) {
      console.error("Failed to fetch Mixpanel settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/mixpanel/connection-status`)
      if (response.ok) {
        const data = await response.json()
        setConnectionStatus(data)
      }
    } catch (error) {
      console.error("Failed to fetch connection status:", error)
    }
  }

  // Submit all form changes
  const handleSubmit = async () => {
    setIsSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch(`${API_BASE}/mixpanel/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        const mergedData = {
          ...DEFAULT_SETTINGS,
          ...data,
          trackedEvents: data.trackedEvents || DEFAULT_SETTINGS.trackedEvents,
        }
        setFormData(mergedData)
        setOriginalData(mergedData)
        setSuccessMessage("설정이 저장되었습니다.")
        onSettingsChange?.()
      } else {
        const error = await response.json()
        setErrorMessage(error.error || "설정 저장에 실패했습니다.")
      }
    } catch (_error) {
      setErrorMessage("설정 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset form to original state
  const handleReset = () => {
    setFormData(originalData)
    setErrorMessage("")
    setSuccessMessage("")
  }

  // Field handlers - only update local state
  const handleToggleEnabled = (enabled: boolean) => {
    setFormData((prev) => ({ ...prev, isEnabled: enabled }))
  }

  const handleToggleAutoCreate = (autoCreate: boolean) => {
    setFormData((prev) => ({ ...prev, autoCreateProspect: autoCreate }))
  }

  const handleToggleAIEnrich = (enrichWithAI: boolean) => {
    setFormData((prev) => ({ ...prev, enrichWithAI }))
  }

  const handleAddEvent = () => {
    if (!newEvent.trim()) return
    const currentEvents = formData.trackedEvents || []
    if (currentEvents.includes(newEvent.trim())) {
      setErrorMessage("이미 추가된 이벤트입니다.")
      return
    }

    const updatedEvents = [...currentEvents, newEvent.trim()]
    setFormData((prev) => ({ ...prev, trackedEvents: updatedEvents }))
    setNewEvent("")
    setErrorMessage("")
  }

  const handleRemoveEvent = (eventToRemove: string) => {
    const updatedEvents = (formData.trackedEvents || []).filter((e) => e !== eventToRemove)
    setFormData((prev) => ({ ...prev, trackedEvents: updatedEvents }))
  }

  const handleSignalStrengthChange = (strength: "high" | "medium" | "low") => {
    setFormData((prev) => ({ ...prev, defaultSignalStrength: strength }))
  }

  const handleSyncIntervalChange = (interval: "hourly" | "every_4_hours" | "daily") => {
    setFormData((prev) => ({ ...prev, syncInterval: interval }))
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch(`${API_BASE}/mixpanel/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage("연결 성공! Mixpanel API에 정상적으로 접속되었습니다.")
      } else {
        setErrorMessage(data.error || "연결 테스트에 실패했습니다.")
      }
    } catch (_error) {
      setErrorMessage("연결 테스트 중 오류가 발생했습니다.")
    } finally {
      setIsTesting(false)
    }
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch(`${API_BASE}/mixpanel/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const message =
          data.created > 0 || data.updated > 0
            ? `동기화 완료: ${data.created}개 생성, ${data.updated}개 업데이트`
            : "동기화 완료: 새로운 이벤트가 없습니다."
        setSuccessMessage(message)
        // Refresh settings to get updated lastSyncAt
        await fetchSettings()
      } else {
        setErrorMessage(data.error || "동기화에 실패했습니다.")
      }
    } catch (_error) {
      setErrorMessage("동기화 중 오류가 발생했습니다.")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleTestEvent = async () => {
    setIsTesting(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch(`${API_BASE}/mixpanel/test-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "$signup",
          email: "test@example.com",
          name: "Test User",
          company: "Test Company Inc.",
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        if (data.result.action === "prospect_created") {
          setSuccessMessage("테스트 성공! 새로운 Prospect가 생성되었습니다.")
        } else if (data.result.action?.includes("updated")) {
          setSuccessMessage("테스트 성공! 기존 데이터가 업데이트되었습니다.")
        } else {
          setSuccessMessage(`테스트 완료: ${data.result.reason || "처리됨"}`)
        }
      } else {
        setErrorMessage(data.error || "테스트에 실패했습니다.")
      }
    } catch (_error) {
      setErrorMessage("테스트 중 오류가 발생했습니다.")
    } finally {
      setIsTesting(false)
    }
  }

  // Report form state to parent component
  useEffect(() => {
    if (onFormStateChange) {
      if (isDirty) {
        onFormStateChange({
          isDirty,
          isSaving,
          onSave: handleSubmit,
          onReset: handleReset,
        })
      } else {
        onFormStateChange(null)
      }
    }
  }, [isDirty, isSaving, onFormStateChange, handleSubmit, handleReset])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onFormStateChange?.(null)
    }
  }, [onFormStateChange])

  const formatLastSyncTime = (isoString: string | null) => {
    if (!isoString) return null
    try {
      return new Date(isoString).toLocaleString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return isoString
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Mixpanel 연동</h3>
        <p className="text-sm text-slate-500">
          Mixpanel에서 이벤트 데이터를 가져와 자동으로 CRM에 등록합니다.
        </p>
      </div>

      {/* Connection Status */}
      {connectionStatus?.success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <IconCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-sm font-semibold text-emerald-900">Mixpanel API 연결됨</span>
              <p className="text-xs text-emerald-700">
                인증 방식:{" "}
                {connectionStatus.data.authType === "service_account"
                  ? "Service Account"
                  : "Project Secret"}
                {connectionStatus?.data.projectId &&
                  ` (Project ID: ${connectionStatus.data.projectId})`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <IconX className="w-5 h-5 text-amber-600" />
            <div>
              <span className="text-sm font-semibold text-amber-900">API 자격 증명 필요</span>
              <p className="text-xs text-amber-700">서버 관리자가 환경 변수를 설정해야 합니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* Setup Guide (if not configured) */}
      {!connectionStatus?.success && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-2">서버 환경 변수 설정 방법</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Mixpanel Project Settings → Project ID 복사</li>
                <li>Project Settings → Access Keys → Project Secret 복사</li>
                <li>서버의 .env 파일에 다음 추가:</li>
              </ol>
              <pre className="mt-2 p-2 bg-blue-100 rounded text-xs font-mono overflow-x-auto">
                {`MIXPANEL_PROJECT_ID=your_project_id
MIXPANEL_PROJECT_SECRET=your_project_secret
MIXPANEL_SYNC_ENABLED=true`}
              </pre>
              <p className="mt-2 text-xs text-blue-700">4. 서버 재시작 후 이 페이지 새로고침</p>
              <a
                href="https://docs.mixpanel.com/docs/orgs-and-projects/managing-projects#find-your-project-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
              >
                <IconExternalLink className="w-3.5 h-3.5" />
                Mixpanel Project 설정 문서 보기
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Configuration (only if credentials are configured) */}
      {connectionStatus?.success && (
        <>
          {/* Test Connection Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isTesting ? (
                <>
                  <IconLoader className="w-4 h-4 animate-spin" />
                  테스트 중...
                </>
              ) : (
                "연결 테스트"
              )}
            </button>
            <span className="text-xs text-slate-500">
              Mixpanel API 자격 증명이 유효한지 확인합니다.
            </span>
          </div>

          {/* Enable Toggle */}
          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-medium text-slate-900">Mixpanel 연동 활성화</h4>
                <p className="text-xs text-slate-500">
                  활성화하면 Mixpanel에서 이벤트를 자동으로 가져옵니다.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isEnabled ?? false}
                  onChange={(e) => handleToggleEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Sync Interval */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">동기화 주기</label>
            <select
              value={formData.syncInterval ?? "hourly"}
              onChange={(e) =>
                handleSyncIntervalChange(e.target.value as "hourly" | "every_4_hours" | "daily")
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="hourly">매시간 (권장)</option>
              <option value="every_4_hours">4시간마다</option>
              <option value="daily">하루에 한 번</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Mixpanel에서 이벤트를 가져오는 주기입니다. 서버 환경 변수(MIXPANEL_SYNC_CRON)로 더
              세밀하게 조정할 수 있습니다.
            </p>
          </div>

          {/* Sync Status & Manual Sync */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">마지막 동기화</p>
                <p className="text-xs text-slate-500">
                  {formData.lastSyncAt
                    ? formatLastSyncTime(formData.lastSyncAt)
                    : "아직 동기화된 적 없음"}
                </p>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing || !originalData.isEnabled}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <IconLoader className="w-4 h-4 animate-spin" />
                    동기화 중...
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-4 h-4" />
                    지금 동기화
                  </>
                )}
              </button>
            </div>
            {!originalData.isEnabled && (
              <p className="mt-2 text-xs text-amber-600">
                수동 동기화를 하려면 먼저 설정을 저장하고 활성화하세요.
              </p>
            )}
          </div>

          {/* Tracked Events */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-900">추적할 이벤트</h4>
            <p className="text-xs text-slate-500">
              이 이벤트가 발생하면 CRM에 자동으로 Prospect를 생성합니다.
            </p>

            <div className="flex flex-wrap gap-2">
              {(formData.trackedEvents || []).map((event) => (
                <span
                  key={event}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 text-sm rounded-full"
                >
                  {event}
                  <button
                    onClick={() => handleRemoveEvent(event)}
                    className="hover:text-indigo-600"
                  >
                    <IconX className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                placeholder="새 이벤트명 (예: user_registered)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === "Enter" && handleAddEvent()}
              />
              <button
                onClick={handleAddEvent}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {/* Auto Create Prospect */}
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
              <div>
                <span className="text-sm font-medium text-slate-700">자동 Prospect 생성</span>
                <p className="text-xs text-slate-500">
                  신규 유저가 감지되면 자동으로 Prospect 생성
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.autoCreateProspect ?? true}
                onChange={(e) => handleToggleAutoCreate(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
              <div>
                <span className="text-sm font-medium text-slate-700">AI 자동 분석</span>
                <p className="text-xs text-slate-500">회사 정보를 AI로 자동 분석하여 보강</p>
              </div>
              <input
                type="checkbox"
                checked={formData.enrichWithAI ?? true}
                onChange={(e) => handleToggleAIEnrich(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Default Signal Strength */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              기본 Signal Strength
            </label>
            <select
              value={formData.defaultSignalStrength ?? "medium"}
              onChange={(e) =>
                handleSignalStrengthChange(e.target.value as "high" | "medium" | "low")
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="high">High - 높은 관심 고객</option>
              <option value="medium">Medium - 일반 관심 고객</option>
              <option value="low">Low - 낮은 관심 고객</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              데이터가 충분하지 않을 경우 적용되는 기본값입니다.
            </p>
          </div>

          {/* Test Event Button */}
          <div className="border-t border-slate-200 pt-6">
            <button
              onClick={handleTestEvent}
              disabled={isTesting || !originalData.isEnabled}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isTesting ? (
                <>
                  <IconLoader className="w-4 h-4 animate-spin" />
                  테스트 중...
                </>
              ) : (
                "테스트 이벤트 처리"
              )}
            </button>
            <p className="mt-1.5 text-xs text-slate-500">
              테스트 Prospect를 생성하여 이벤트 처리가 정상 작동하는지 확인합니다.
              {!originalData.isEnabled && " (먼저 설정을 저장하고 활성화하세요)"}
            </p>
          </div>
        </>
      )}

      {/* Messages */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center gap-1">
            <IconX className="w-4 h-4" />
            {errorMessage}
          </p>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-600 flex items-center gap-1">
            <IconCheck className="w-4 h-4" />
            {successMessage}
          </p>
        </div>
      )}

      {/* Supported Properties (always visible) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-900 mb-2">지원되는 Mixpanel 속성</p>
        <div className="text-xs text-slate-600 space-y-1">
          <p>
            <code className="bg-slate-200 px-1 rounded">$email</code>,{" "}
            <code className="bg-slate-200 px-1 rounded">email</code> - 이메일 주소
          </p>
          <p>
            <code className="bg-slate-200 px-1 rounded">$name</code>,{" "}
            <code className="bg-slate-200 px-1 rounded">name</code> - 사용자 이름
          </p>
          <p>
            <code className="bg-slate-200 px-1 rounded">$company</code>,{" "}
            <code className="bg-slate-200 px-1 rounded">company</code> - 회사명
          </p>
          <p>
            <code className="bg-slate-200 px-1 rounded">$phone</code>,{" "}
            <code className="bg-slate-200 px-1 rounded">phone</code> - 전화번호
          </p>
          <p>
            <code className="bg-slate-200 px-1 rounded">industry</code> - 산업 분야
          </p>
          <p>
            <code className="bg-slate-200 px-1 rounded">company_size</code> - 회사 규모
          </p>
          <p>
            <code className="bg-slate-200 px-1 rounded">utm_source</code>,{" "}
            <code className="bg-slate-200 px-1 rounded">utm_campaign</code> - 유입 경로
          </p>
        </div>
      </div>
    </div>
  )
}
