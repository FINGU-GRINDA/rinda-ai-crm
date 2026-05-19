import type React from "react"
import { useState } from "react"
import type { EmailSettings } from "../../../types"
import { IconLoader, IconMail } from "../../Icons"
import { useSettingsToast } from "../SettingsToastContext"
import {
  btnGhost,
  btnSecondary,
  card,
  infoNote,
  inputBase,
  pageDesc,
  pageTitle,
  sectionDesc,
  sectionTitle,
  tile,
  toggle,
} from "../tokens"

const EMAIL_SETTINGS_KEY = "rinda_email_settings"

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: null,
  isConnected: false,
  autoSync: true,
  syncInterval: 300000,
  lastSyncAt: undefined,
}

const getEmailSettings = (): EmailSettings => {
  try {
    const stored = localStorage.getItem(EMAIL_SETTINGS_KEY)
    if (stored) {
      return { ...DEFAULT_EMAIL_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error("Failed to load email settings:", error)
  }
  return DEFAULT_EMAIL_SETTINGS
}

const saveEmailSettings = (settings: EmailSettings): void => {
  localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings))
}

const PROVIDER_LABEL: Record<NonNullable<EmailSettings["provider"]>, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
}

const PROVIDER_DESC: Record<NonNullable<EmailSettings["provider"]>, string> = {
  gmail: "Google 계정으로 연결",
  outlook: "Microsoft 계정으로 연결",
}

interface EmailIntegrationTabProps {
  onSettingsChange?: () => void
}

export const EmailIntegrationTab: React.FC<EmailIntegrationTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<EmailSettings>(() => getEmailSettings())
  const [connectingProvider, setConnectingProvider] = useState<EmailSettings["provider"] | null>(
    null,
  )
  const toast = useSettingsToast()

  const persist = (next: EmailSettings, message = "저장되었습니다") => {
    setSettings(next)
    try {
      saveEmailSettings(next)
      onSettingsChange?.()
      toast.show("success", message)
    } catch (error) {
      console.error(error)
      toast.show("error", "저장에 실패했습니다")
    }
  }

  const handleConnect = async (provider: "gmail" | "outlook") => {
    setConnectingProvider(provider)
    // 시뮬레이션 — 실제 OAuth는 백엔드 라우트가 처리
    await new Promise((resolve) => setTimeout(resolve, 1200))
    persist(
      {
        ...settings,
        provider,
        isConnected: true,
        lastSyncAt: new Date().toISOString(),
      },
      `${PROVIDER_LABEL[provider]}이(가) 연동되었습니다`,
    )
    setConnectingProvider(null)
  }

  const handleDisconnect = () => {
    persist({ ...DEFAULT_EMAIL_SETTINGS }, "연동이 해제되었습니다")
  }

  return (
    <div className="space-y-6">
      <header>
        <h3 className={pageTitle}>이메일 연동</h3>
        <p className={pageDesc}>
          이메일을 연동해 고객 커뮤니케이션을 자동으로 기록하고 분석합니다.
        </p>
      </header>

      {settings.isConnected && settings.provider ? (
        <ConnectedCard
          providerLabel={PROVIDER_LABEL[settings.provider]}
          lastSyncAt={settings.lastSyncAt}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <section>
          <div className="mb-3">
            <h4 className={sectionTitle}>제공자 선택</h4>
            <p className={sectionDesc}>연결할 이메일 서비스를 선택하세요</p>
          </div>

          <div className="space-y-2">
            {(["gmail", "outlook"] as const).map((provider) => (
              <ProviderTile
                key={provider}
                name={PROVIDER_LABEL[provider]}
                description={PROVIDER_DESC[provider]}
                onClick={() => handleConnect(provider)}
                isConnecting={connectingProvider === provider}
                disabled={connectingProvider !== null}
              />
            ))}
          </div>
        </section>
      )}

      {settings.isConnected && (
        <SyncSettings
          settings={settings}
          onChange={(updates) => persist({ ...settings, ...updates })}
        />
      )}

      <div className={infoNote}>
        OAuth 연결은 시뮬레이션 모드입니다. 실제 연동은 운영 환경에서 OAuth 자격 증명을 구성한 후
        사용할 수 있습니다.
      </div>
    </div>
  )
}

interface ConnectedCardProps {
  providerLabel: string
  lastSyncAt?: string
  onDisconnect: () => void
}

const ConnectedCard: React.FC<ConnectedCardProps> = ({
  providerLabel,
  lastSyncAt,
  onDisconnect,
}) => (
  <section className={card}>
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{providerLabel} 연동됨</p>
          {lastSyncAt && (
            <p className="text-xs text-slate-500 mt-0.5">
              마지막 동기화: {new Date(lastSyncAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      </div>
      <button type="button" onClick={onDisconnect} className={btnGhost}>
        연동 해제
      </button>
    </div>
  </section>
)

interface ProviderTileProps {
  name: string
  description: string
  onClick: () => void
  isConnecting: boolean
  disabled: boolean
}

const ProviderTile: React.FC<ProviderTileProps> = ({
  name,
  description,
  onClick,
  isConnecting,
  disabled,
}) => (
  <button type="button" onClick={onClick} disabled={disabled} className={tile}>
    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
      <IconMail className="w-5 h-5 text-slate-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-900">{name}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    {isConnecting && <IconLoader className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />}
  </button>
)

interface SyncSettingsProps {
  settings: EmailSettings
  onChange: (updates: Partial<EmailSettings>) => void
}

const SyncSettings: React.FC<SyncSettingsProps> = ({ settings, onChange }) => (
  <section>
    <div className="mb-3">
      <h4 className={sectionTitle}>동기화</h4>
      <p className={sectionDesc}>새 이메일을 자동으로 가져옵니다</p>
    </div>

    <div className={`${card} space-y-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">자동 동기화</p>
          <p className="text-xs text-slate-500 mt-0.5">백그라운드에서 주기적으로 동기화</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoSync}
            onChange={(e) => onChange({ autoSync: e.target.checked })}
            className="sr-only peer"
          />
          <div className={toggle} />
        </label>
      </div>

      {settings.autoSync && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">동기화 주기</label>
          <select
            value={settings.syncInterval}
            onChange={(e) => onChange({ syncInterval: parseInt(e.target.value, 10) })}
            className={inputBase}
          >
            <option value={300000}>5분마다</option>
            <option value={600000}>10분마다</option>
            <option value={900000}>15분마다</option>
            <option value={1800000}>30분마다</option>
            <option value={3600000}>1시간마다</option>
          </select>
        </div>
      )}

      <div className="pt-1">
        <button type="button" className={btnSecondary}>
          지금 동기화
        </button>
      </div>
    </div>
  </section>
)
