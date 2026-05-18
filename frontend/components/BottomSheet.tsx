import { X } from "lucide-react"
import type React from "react"
import { useCallback, useEffect } from "react"

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  height?: "auto" | "half" | "full"
  showCloseButton?: boolean
  showDragHandle?: boolean
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  height = "auto",
  showCloseButton = true,
  showDragHandle = true,
}) => {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    },
    [onClose],
  )

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      document.addEventListener("keydown", handleEscape)
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const heightClasses = {
    auto: "max-h-[90vh]",
    half: "h-[50vh]",
    full: "h-[95vh]",
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl
                    animate-slide-in-from-bottom flex flex-col safe-bottom
                    ${heightClasses[height]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "bottom-sheet-title" : undefined}
      >
        {/* Drag Handle */}
        {showDragHandle && (
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div className="drag-handle" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-200 flex-shrink-0">
            {title && (
              <h2 id="bottom-sheet-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors touch-target"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">{children}</div>
      </div>
    </div>
  )
}

// Desktop Modal wrapper - renders children as-is for desktop
interface ResponsiveModalProps extends BottomSheetProps {
  desktopContent?: React.ReactNode
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  height = "auto",
  desktopContent,
}) => {
  if (!isOpen) return null

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden">
        <BottomSheet isOpen={isOpen} onClose={onClose} title={title} height={height}>
          {children}
        </BottomSheet>
      </div>

      {/* Desktop: Regular Modal */}
      <div className="hidden md:block">{desktopContent || children}</div>
    </>
  )
}

export default BottomSheet
