import type React from "react"
import { IconX } from "./Icons"

/**
 * Error States - Consistent error UI
 */

interface ErrorStateProps {
  type?: "api_key" | "network" | "permission" | "general"
  title?: string
  message: string
  action?: () => void
  actionText?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = "general",
  title,
  message,
  action,
  actionText,
}) => {
  const icons = {
    api_key: "🔑",
    network: "📡",
    permission: "🚫",
    general: "⚠️",
  }

  const defaultTitles = {
    api_key: "API Key 설정 필요",
    network: "네트워크 오류",
    permission: "권한 오류",
    general: "오류 발생",
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <div className="text-4xl mb-3">{icons[type]}</div>
      <h3 className="text-sm font-semibold text-red-900 mb-2">{title || defaultTitles[type]}</h3>
      <p className="text-sm text-red-700 mb-4">{message}</p>

      {action && actionText && (
        <button
          onClick={action}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}

// Inline error (for forms)
export const InlineError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 text-xs text-red-600 mt-1">
    <IconX className="w-3 h-3" />
    <span>{message}</span>
  </div>
)
