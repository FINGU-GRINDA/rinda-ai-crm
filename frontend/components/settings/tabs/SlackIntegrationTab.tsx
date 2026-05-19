import type React from "react"
import { useEffect, useState } from "react"
import {
  getSlackSettings,
  SLACK_SETTINGS_KEY,
  sendTestMessage,
  validateWebhookUrl,
} from "../../../services/slackIntegrationService"
import { setItemOrThrow } from "../../../src/utils/safeStorage"
import type { SlackSettings } from "../../../types"
import { IconCheck, IconExternalLink, IconLoader } from "../../Icons"
import { useSettingsToast } from "../SettingsToastContext"
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  checkbox,
  divideRows,
  infoNote,
  inputBase,
  inputError,
  inputValid,
  linkSubtle,
  pageDesc,
  pageTitle,
  sectionDesc,
  sectionTitle,
  toggle,
} from "../tokens"

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

interface SlackIntegrationTabProps {
  onSettingsChange?: () => void
}

type ValidationStatus = "idle" | "validating" | "valid" | "invalid"

const NOTIFICATION_ROWS: {
  key: keyof SlackSettings["notifications"]
  label: string
  desc: string
}[] = [
  { key: "newProspect", label: "새 잠재고객 발견", desc: "AI가 새 잠재고객을 발견했을 때" },
  { key: "followUpReminder", label: "팔로우업 리마인더", desc: "예정된 팔로우업 시점에" },
  { key: "followUpCompleted", label: "팔로우업 완료", desc: "팔로우업이 완료 처리되었을 때" },
  { key: "dailyDigest", label: "일일 다이제스트", desc: "매일 정해진 시간에 당일 요약" },
  { key: "dealWon", label: "계약 성사", desc: "거래가 성공으로 종료되었을 때" },
  { key: "dealLost", label: "거래 실패", desc: "거래가 실패로 종료되었을 때" },
]

export const SlackIntegrationTab: React.FC<SlackIntegrationTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<SlackSettings>(() => getSlackSettings())
  const [webhookDraft, setWebhookDraft] = useState(settings.webhookUrl)
  const [validation, setValidation] = useState<ValidationStatus>(
    settings.isValidated ? "valid" : "idle",
  )
  const [validationError, setValidationError] = useState("")
  const [isSendingTest, setIsSendingTest] = useState(false)
  const toast = useSettingsToast()

  useEffect(() => {
    if (webhookDraft !== settings.webhookUrl) {
      setValidation("idle")
      setValidationError("")
    }
  }, [webhookDraft, settings.webhookUrl])

  const persist = (next: SlackSettings, message = "저장되었습니다") => {
    setSettings(next)
    try {
      setItemOrThrow(SLACK_SETTINGS_KEY, next)
      onSettingsChange?.()
      toast.show("success", message)
    } catch (error) {
      console.error(error)
      toast.show("error", "저장에 실패했습니다")
    }
  }

  // Merge-on-write update so async handlers don't overwrite changes the user
  // made while the request was in flight. Reads the latest state via the
  // functional updater rather than the closure-captured snapshot.
  const persistMerge = (updates: Partial<SlackSettings>, message = "저장되었습니다") => {
    setSettings((prev) => {
      const next = { ...prev, ...updates }
      try {
        setItemOrThrow(SLACK_SETTINGS_KEY, next)
        onSettingsChange?.()
        toast.show("success", message)
      } catch (error) {
        console.error(error)
        toast.show("error", "저장에 실패했습니다")
      }
      return next
    })
  }

  const handleValidate = async () => {
    setValidationError("")
    if (!webhookDraft) return
    if (!webhookDraft.startsWith("https://hooks.slack.com/")) {
      setValidation("invalid")
      setValidationError("https://hooks.slack.com/ 으로 시작하는 URL이어야 합니다")
      return
    }
    setValidation("validating")
    const result = await validateWebhookUrl(webhookDraft)
    if (result.success) {
      setValidation("valid")
      persist(
        { ...settings, webhookUrl: webhookDraft, isValidated: true },
        "Webhook이 확인되었습니다",
      )
    } else {
      setValidation("invalid")
      setValidationError(result.error || "검증에 실패했습니다")
    }
  }

  const handleSendTest = async () => {
    if (!settings.isValidated || !settings.webhookUrl) return
    setIsSendingTest(true)
    const result = await sendTestMessage(settings.webhookUrl)
    if (result.success) {
      persistMerge({ lastTestAt: new Date().toISOString() }, "테스트 메시지를 보냈습니다")
    } else {
      toast.show("error", result.error || "테스트 메시지 전송에 실패했습니다")
    }
    setIsSendingTest(false)
  }

  const handleDisconnect = () => {
    setWebhookDraft("")
    setValidation("idle")
    persist(DEFAULT_SETTINGS, "연동이 해제되었습니다")
  }

  const inputState =
    validation === "valid" ? inputValid : validation === "invalid" ? inputError : ""

  return (
    <div className="space-y-6">
      <header>
        <h3 className={pageTitle}>Slack 연동</h3>
        <p className={pageDesc}>
          Slack Webhook으로 CRM 알림을 받습니다. URL 입력 후 검증 버튼을 눌러야 연동이 완료됩니다.
        </p>
      </header>

      {settings.isValidated && (
        <section className={card}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Slack 연동됨</p>
                {settings.lastTestAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    마지막 테스트: {new Date(settings.lastTestAt).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={handleDisconnect} className={btnGhost}>
              연동 해제
            </button>
          </div>
        </section>
      )}

      <section>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={webhookDraft}
            onChange={(e) => setWebhookDraft(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className={`${inputBase} ${inputState} font-mono`}
          />
          <button
            type="button"
            onClick={handleValidate}
            disabled={
              validation === "validating" ||
              !webhookDraft ||
              (webhookDraft === settings.webhookUrl && settings.isValidated)
            }
            className={`${btnPrimary} flex-shrink-0`}
          >
            {validation === "validating" ? (
              <>
                <IconLoader className="w-4 h-4 animate-spin" />
                검증
              </>
            ) : validation === "valid" && webhookDraft === settings.webhookUrl ? (
              <>
                <IconCheck className="w-4 h-4" />
                확인됨
              </>
            ) : (
              "검증"
            )}
          </button>
        </div>
        {validationError && <p className="mt-1.5 text-xs text-red-600">{validationError}</p>}
        {!settings.isValidated && !validationError && (
          <p className="mt-1.5 text-xs text-slate-500">검증 성공 시 자동으로 저장됩니다</p>
        )}

        {settings.isValidated && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest}
              className={btnSecondary}
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
          </div>
        )}
      </section>

      {settings.isValidated && (
        <section>
          <div className="mb-3">
            <h4 className={sectionTitle}>알림 유형</h4>
            <p className={sectionDesc}>전체 사용을 켠 뒤 받을 알림을 선택하세요</p>
          </div>

          <div className={`${card} p-0`}>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Slack 알림 사용</p>
                <p className="text-xs text-slate-500 mt-0.5">아래 항목이 Slack으로 전송됩니다</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(e) => persist({ ...settings, isEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={toggle} />
              </label>
            </div>

            {settings.isEnabled && (
              <div className={`${divideRows} border-t border-slate-100`}>
                {NOTIFICATION_ROWS.map((row) => (
                  <label
                    key={row.key}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-800">{row.label}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{row.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications[row.key] ?? false}
                      onChange={(e) =>
                        persist({
                          ...settings,
                          notifications: { ...settings.notifications, [row.key]: e.target.checked },
                        })
                      }
                      className={checkbox}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className={infoNote}>
        <p className="font-medium text-slate-800 mb-1">Webhook URL은 어디서 받나요?</p>
        <p>
          Slack 워크스페이스에서 Apps → Incoming Webhooks 추가 → 알림을 받을 채널 선택 후 생성된
          URL을 복사해 붙여넣으세요.
        </p>
        <a
          href="https://api.slack.com/messaging/webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkSubtle} mt-2`}
        >
          <IconExternalLink className="w-3.5 h-3.5" />
          Slack Webhook 문서
        </a>
      </div>
    </div>
  )
}
