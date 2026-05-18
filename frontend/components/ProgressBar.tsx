import type React from "react"

interface ProgressBarProps {
  progress: number // 0-100
  message?: string
  showPercentage?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message,
  showPercentage = false,
}) => {
  return (
    <div className="w-full">
      {message && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-600">{message}</span>
          {showPercentage && (
            <span className="text-xs font-semibold text-blue-600">{Math.round(progress)}%</span>
          )}
        </div>
      )}

      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full relative overflow-hidden"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
      </div>
    </div>
  )
}
