import { CreditCard, Mic, Plus, X } from "lucide-react"
import type React from "react"
import { useCallback, useState } from "react"

interface FloatingActionButtonProps {
  onBusinessCardClick: () => void
  onMeetingRecordClick: () => void
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onBusinessCardClick,
  onMeetingRecordClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleBusinessCardClick = useCallback(() => {
    setIsExpanded(false)
    onBusinessCardClick()
  }, [onBusinessCardClick])

  const handleMeetingRecordClick = useCallback(() => {
    setIsExpanded(false)
    onMeetingRecordClick()
  }, [onMeetingRecordClick])

  return (
    <div className="fixed bottom-20 right-4 z-40 md:hidden">
      {/* Backdrop */}
      {isExpanded && <div className="fixed inset-0 bg-black/20" onClick={handleToggle} />}

      {/* Action Menu */}
      <div
        className={`absolute bottom-16 right-0 flex flex-col gap-3 mb-2 transition-all duration-200 ${
          isExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Business Card Scan Button */}
        <button
          onClick={handleBusinessCardClick}
          className="flex items-center gap-3 bg-violet-600 text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:bg-violet-700 active:scale-95 transition-all whitespace-nowrap"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">명함 스캔</span>
        </button>

        {/* Meeting Record Button */}
        <button
          onClick={handleMeetingRecordClick}
          className="flex items-center gap-3 bg-red-600 text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:bg-red-700 active:scale-95 transition-all whitespace-nowrap"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">미팅 녹음</span>
        </button>
      </div>

      {/* Main FAB Button */}
      <button
        onClick={handleToggle}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95 ${
          isExpanded ? "bg-slate-700 rotate-45" : "bg-blue-600 hover:bg-blue-700"
        }`}
        aria-label={isExpanded ? "닫기" : "빠른 작업"}
      >
        {isExpanded ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Plus className="w-5 h-5 text-white" />
        )}
      </button>
    </div>
  )
}

export default FloatingActionButton
