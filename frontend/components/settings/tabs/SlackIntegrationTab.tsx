import type React from "react"
import { useEffect, useState } from "react"
import {
  getSlackSettings,
  saveSlackSettings,
  sendTestMessage,
  validateWebhookUrl,
} from "../../../services/slackIntegrationService"
import type { SlackSettings } from "../../../types"
import { IconCheck, IconExternalLink, IconLoader, IconX } from "../../Icons"

export interface SlackFormState {
  isDirty: boolean
  isSaving: boolean
  onSave: () => Promise<void>
  onReset: () => void
}

interface SlackIntegrationTabProps {
  onSettingsChange?: () => void
  onFormStateChange?: (state: SlackFormState | null) => void
}

const DEFAULT_SETTINGS: SlackSettings = {
  webhookUrl: "",
  isEnabled: false,
  notifications: {
    newProspect: true,
    followUpReminder: true,
    followUpCompleted: true,
    dailyDigest: false,
    dealWon: false,
    dealLost: false,
  },
  isValidated: false,
}

export const SlackIntegrationTab: React.FC<SlackIntegrationTabProps> = ({
  onSettingsChange,
  onFormStateChange,
}) => {
  // Form state (local edits)
  const [formData, setFormData] = useState<SlackSettings>(() => getSlackSettings())
  // Server state (last saved)
  const [originalData, setOriginalData] = useState<SlackSettings>(() => getSlackSettings())
  // Track unsaved changes
  const [isDirty, setIsDirty] = useState(false)

  const [webhookUrl, setWebhookUrl] = useState(formData.webhookUrl)
  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >(formData.isValidated ? "valid" : "idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Check if form is dirty
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData)
    setIsDirty(hasChanges)
  }, [formData, originalData])

  // URL 변경 감지
  useEffect(() => {
    if (webhookUrl !== formData.webhookUrl) {
      setValidationStatus("idle")
      setFormData((prev) => ({ ...prev, isValidated: false, webhookUrl }))
    }
  }, [webhookUrl, formData.webhookUrl])

  // Submit all form changes
  const handleSubmit = async () => {
    setIsSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      saveSlackSettings(formData)
      setOriginalData(formData)
      setSuccessMessage("설정이 저장되었습니다.")
      onSettingsChange?.()
    } catch (_error) {
      setErrorMessage("설정 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset form to original state
  const handleReset = () => {
    setFormData(originalData)
    setWebhookUrl(originalData.webhookUrl)
    setValidationStatus(originalData.isValidated ? "valid" : "idle")
    setErrorMessage("")
    setSuccessMessage("")
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

  const handleValidateWebhook = async () => {
    if (!webhookUrl) {
      setErrorMessage("Webhook URL을 입력해주세요.")
      return
    }

    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      setErrorMessage("올바른 Slack Webhook URL 형식이 아닙니다. (https://hooks.slack.com/...)")
      setValidationStatus("invalid")
      return
    }

    setIsValidating(true)
    setValidationStatus("validating")
    setErrorMessage("")
    setSuccessMessage("")

    const result = await validateWebhookUrl(webhookUrl)

    if (result.success) {
      setValidationStatus("valid")
      setFormData((prev) => ({ ...prev, webhookUrl, isValidated: true }))
      setSuccessMessage("Webhook URL이 확인되었습니다!")
    } else {
      setValidationStatus("invalid")
      setErrorMessage(result.error || "Webhook URL 검증에 실패했습니다.")
    }

    setIsValidating(false)
  }

  const handleSendTest = async () => {
    if (!originalData.isValidated || !originalData.webhookUrl) {
      setErrorMessage("먼저 Webhook URL을 검증하고 저장해주세요.")
      return
    }

    setIsSendingTest(true)
    setErrorMessage("")
    setSuccessMessage("")

    const result = await sendTestMessage(originalData.webhookUrl)

    if (result.success) {
      setSuccessMessage("테스트 메시지가 Slack으로 전송되었습니다!")
      const newSettings = { ...formData, lastTestAt: new Date().toISOString() }
      setFormData(newSettings)
      // Also update original since this is a side effect
      setOriginalData((prev) => ({ ...prev, lastTestAt: new Date().toISOString() }))
      saveSlackSettings({ ...originalData, lastTestAt: new Date().toISOString() })
    } else {
      setErrorMessage(result.error || "테스트 메시지 전송에 실패했습니다.")
    }

    setIsSendingTest(false)
  }

  const handleToggleEnabled = (enabled: boolean) => {
    setFormData((prev) => ({ ...prev, isEnabled: enabled }))
  }

  const handleToggleNotification = (key: keyof SlackSettings["notifications"], value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }))
  }

  const handleDisconnect = () => {
    setFormData(DEFAULT_SETTINGS)
    setWebhookUrl("")
    setValidationStatus("idle")
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Slack 연동</h3>
        <p className="text-sm text-slate-500">Slack Webhook을 통해 CRM 알림을 받아보세요.</p>
      </div>

      {/* Connection Status */}
      {formData.isValidated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <IconCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="text-sm font-semibold text-emerald-900">Slack 연동됨</span>
                {formData.lastTestAt && (
                  <p className="text-xs text-emerald-700">
                    마지막 테스트: {new Date(formData.lastTestAt).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline"
            >
              연동 해제
            </button>
          </div>
        </div>
      )}

      {/* Webhook URL Input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Slack Webhook URL</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className={`w-full px-4 py-2.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 transition-all ${
                validationStatus === "valid"
                  ? "border-emerald-300 bg-emerald-50 focus:ring-emerald-500"
                  : validationStatus === "invalid"
                    ? "border-red-300 bg-red-50 focus:ring-red-500"
                    : "border-slate-300 bg-white focus:ring-indigo-500"
              }`}
            />
            {validationStatus === "valid" && (
              <IconCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />
            )}
          </div>
          <button
            onClick={handleValidateWebhook}
            disabled={isValidating || !webhookUrl}
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isValidating ? (
              <>
                <IconLoader className="w-4 h-4 animate-spin" />
                검증 중...
              </>
            ) : (
              "검증"
            )}
          </button>
        </div>

        {/* Messages */}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <IconX className="w-3 h-3" />
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
            <IconCheck className="w-3 h-3" />
            {successMessage}
          </p>
        )}
      </div>

      {/* Test Message Button */}
      {originalData.isValidated && (
        <div>
          <button
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSendingTest ? (
              <>
                <IconLoader className="w-4 h-4 animate-spin" />
                전송 중...
              </>
            ) : (
              "테스트 메시지 보내기"
            )}
          </button>
          <p className="mt-1 text-xs text-slate-500">
            {isDirty && "(저장된 설정으로 테스트합니다)"}
          </p>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      {formData.isValidated && (
        <div className="border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-medium text-slate-900">Slack 알림 활성화</h4>
              <p className="text-xs text-slate-500">알림을 Slack으로 받을지 설정합니다.</p>
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
      )}

      {/* Notification Types */}
      {formData.isValidated && formData.isEnabled && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-900">알림 유형 설정</h4>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-700">새 잠재고객 발견</span>
              <p className="text-xs text-slate-500">AI가 새로운 잠재고객을 발견하면 알림</p>
            </div>
            <input
              type="checkbox"
              checked={formData.notifications.newProspect ?? true}
              onChange={(e) => handleToggleNotification("newProspect", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-700">팔로우업 리마인더</span>
              <p className="text-xs text-slate-500">예정된 팔로우업 시간이 되면 알림</p>
            </div>
            <input
              type="checkbox"
              checked={formData.notifications.followUpReminder ?? true}
              onChange={(e) => handleToggleNotification("followUpReminder", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-700">팔로우업 완료</span>
              <p className="text-xs text-slate-500">팔로우업이 완료 처리되면 알림</p>
            </div>
            <input
              type="checkbox"
              checked={formData.notifications.followUpCompleted ?? true}
              onChange={(e) => handleToggleNotification("followUpCompleted", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-700">일일 다이제스트</span>
              <p className="text-xs text-slate-500">매일 정해진 시간에 당일 팔로우업 요약 알림</p>
            </div>
            <input
              type="checkbox"
              checked={formData.notifications.dailyDigest ?? false}
              onChange={(e) => handleToggleNotification("dailyDigest", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-700">계약 성사</span>
              <p className="text-xs text-slate-500">고객이 계약 완료 상태로 변경되면 알림</p>
            </div>
            <input
              type="checkbox"
              checked={formData.notifications.dealWon ?? false}
              onChange={(e) => handleToggleNotification("dealWon", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-700">거래 실패</span>
              <p className="text-xs text-slate-500">거래가 실패로 종료되면 알림</p>
            </div>
            <input
              type="checkbox"
              checked={formData.notifications.dealLost ?? false}
              onChange={(e) => handleToggleNotification("dealLost", e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
          </label>
        </div>
      )}

      {/* Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-2">Slack Webhook 생성 방법</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Slack 워크스페이스에서 Apps → Incoming Webhooks를 추가하세요</li>
              <li>알림을 받을 채널을 선택하세요</li>
              <li>생성된 Webhook URL을 복사하여 위 입력창에 붙여넣기 하세요</li>
            </ol>
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              <IconExternalLink className="w-3.5 h-3.5" />
              Slack Webhook 문서 보기
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
