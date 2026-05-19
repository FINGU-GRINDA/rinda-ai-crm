import type React from "react"
import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { getSlackSettings } from "../../services/slackIntegrationService"
import { safeGetItem } from "../../src/utils/safeStorage"
import type { SettingsTabType } from "../../types"
import { IconLoader, IconSettings, IconX } from "../Icons"
import { SettingsTabBar } from "./SettingsTabBar"
import { SettingsToastProvider } from "./SettingsToastContext"

const AISettingsTab = lazy(() =>
  import("./tabs/AISettingsTab").then((m) => ({ default: m.AISettingsTab })),
)
const ProspectSettingsTab = lazy(() =>
  import("./tabs/ProspectSettingsTab").then((m) => ({ default: m.ProspectSettingsTab })),
)
const SlackIntegrationTab = lazy(() =>
  import("./tabs/SlackIntegrationTab").then((m) => ({ default: m.SlackIntegrationTab })),
)
const EmailIntegrationTab = lazy(() =>
  import("./tabs/EmailIntegrationTab").then((m) => ({ default: m.EmailIntegrationTab })),
)
const CalendarIntegrationTab = lazy(() =>
  import("./tabs/CalendarIntegrationTab").then((m) => ({ default: m.CalendarIntegrationTab })),
)
const NotificationSettingsTab = lazy(() =>
  import("./tabs/NotificationSettingsTab").then((m) => ({ default: m.NotificationSettingsTab })),
)

interface UnifiedSettingsProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SettingsTabType
  onSettingsChange?: () => void
  existingCompanyNames?: string[]
}

const TabLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <IconLoader className="w-6 h-6 text-slate-300 animate-spin" />
  </div>
)

export const UnifiedSettings: React.FC<UnifiedSettingsProps> = ({
  isOpen,
  onClose,
  initialTab = "ai",
  onSettingsChange,
  existingCompanyNames = [],
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabType>(initialTab)
  const [connectionStatus, setConnectionStatus] = useState({
    slack: false,
    email: false,
    calendar: false,
  })

  const updateConnectionStatus = useCallback(() => {
    const emailSettings = safeGetItem<{ isConnected?: boolean }>("rinda_email_settings", {})
    const calendarSettings = safeGetItem<{ isConnected?: boolean }>("rinda_calendar_settings", {})

    setConnectionStatus({
      slack: getSlackSettings().isValidated,
      email: emailSettings.isConnected || false,
      calendar: calendarSettings.isConnected || false,
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      updateConnectionStatus()
      if (initialTab) {
        setActiveTab(initialTab)
      }
    }
  }, [isOpen, initialTab, updateConnectionStatus])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [isOpen, onClose])

  const handleSettingsChange = () => {
    updateConnectionStatus()
    onSettingsChange?.()
  }

  if (!isOpen) return null

  const renderTabContent = () => {
    switch (activeTab) {
      case "ai":
        return <AISettingsTab />
      case "prospect":
        return (
          <ProspectSettingsTab
            onSettingsChange={handleSettingsChange}
            existingCompanyNames={existingCompanyNames}
          />
        )
      case "slack":
        return <SlackIntegrationTab onSettingsChange={handleSettingsChange} />
      case "email":
        return <EmailIntegrationTab onSettingsChange={handleSettingsChange} />
      case "calendar":
        return <CalendarIntegrationTab onSettingsChange={handleSettingsChange} />
      case "notifications":
        return <NotificationSettingsTab onSettingsChange={handleSettingsChange} />
      default:
        return null
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-4xl h-[95vh] md:h-auto md:max-h-[88vh] animate-slide-in-from-bottom md:animate-in md:zoom-in-95 duration-300 flex flex-col safe-bottom overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <SettingsToastProvider>
          {/* Drag Handle (Mobile Only) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-5 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <IconSettings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-slate-900">설정</h2>
                <p className="text-xs text-slate-500 mt-0.5 hidden md:block">
                  연동, 알림, 잠재고객 수집 설정을 관리합니다
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-[transform,background-color,color] duration-150 touch-target"
              aria-label="닫기 (Esc)"
              title="닫기 (Esc)"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Tab Bar */}
          <div className="md:hidden border-b border-slate-200 overflow-x-auto scrollbar-hide flex-shrink-0">
            <div className="flex px-4 py-2 gap-2 min-w-max">
              <SettingsTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                connectionStatus={connectionStatus}
                horizontal={true}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            <div className="hidden md:block p-4 border-r border-slate-200 flex-shrink-0 overflow-y-auto">
              <SettingsTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                connectionStatus={connectionStatus}
              />
            </div>

            <div className="flex-1 px-4 py-5 md:px-6 md:py-6 overflow-y-auto">
              <Suspense fallback={<TabLoader />}>
                {/* key={activeTab} re-mounts on tab change so the fade-in plays. */}
                <div
                  key={activeTab}
                  className="animate-in fade-in slide-in-from-right-1 duration-200 motion-reduce:animate-none"
                >
                  {renderTabContent()}
                </div>
              </Suspense>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex-shrink-0">
            <p className="text-xs text-slate-500 hidden md:block">
              변경 사항은 자동으로 저장됩니다
            </p>
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] rounded-lg transition-[transform,background-color,border-color] duration-150"
            >
              닫기
            </button>
          </div>
        </SettingsToastProvider>
      </div>
    </div>
  )
}
