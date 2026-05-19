import type React from "react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { IconCheck, IconX } from "../Icons"

type ToastKind = "success" | "error"

interface ToastState {
  id: number
  kind: ToastKind
  message: string
  // `visible` drives the slide-in/out CSS state. On dismiss we flip it to
  // false first so the exit animation can play before we unmount.
  visible: boolean
}

interface SettingsToastValue {
  show: (kind: ToastKind, message: string) => void
}

const SettingsToastCtx = createContext<SettingsToastValue | null>(null)

export const useSettingsToast = (): SettingsToastValue => {
  const v = useContext(SettingsToastCtx)
  if (!v) throw new Error("useSettingsToast must be used inside SettingsToastProvider")
  return v
}

interface ProviderProps {
  children: React.ReactNode
}

const VISIBLE_MS = 2400
const EXIT_MS = 180

export const SettingsToastProvider: React.FC<ProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current)
      unmountTimerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimers()
    setToast((current) => (current ? { ...current, visible: false } : null))
    unmountTimerRef.current = setTimeout(() => {
      setToast(null)
      unmountTimerRef.current = null
    }, EXIT_MS)
  }, [clearTimers])

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      clearTimers()
      idRef.current += 1
      const id = idRef.current
      // Two-step mount-then-show so the CSS transition has an initial state
      // to interpolate from (otherwise it pops in without animating).
      setToast({ id, kind, message, visible: false })
      requestAnimationFrame(() => {
        setToast((current) => (current?.id === id ? { ...current, visible: true } : current))
      })
      hideTimerRef.current = setTimeout(() => {
        setToast((current) => (current?.id === id ? { ...current, visible: false } : current))
        hideTimerRef.current = null
        unmountTimerRef.current = setTimeout(() => {
          setToast((current) => (current?.id === id ? null : current))
          unmountTimerRef.current = null
        }, EXIT_MS)
      }, VISIBLE_MS)
    },
    [clearTimers],
  )

  useEffect(() => clearTimers, [clearTimers])

  return (
    <SettingsToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 bottom-20 md:bottom-6 flex justify-center px-4 z-20"
        >
          <div
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border text-sm font-medium transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
              toast.visible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-2 scale-95"
            } ${
              toast.kind === "success"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-red-600 text-white border-red-600"
            }`}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full ${
                toast.kind === "success" ? "bg-emerald-500/30" : "bg-white/15"
              }`}
            >
              {toast.kind === "success" ? (
                <IconCheck className="w-3.5 h-3.5" strokeWidth={3} />
              ) : (
                <IconX className="w-3.5 h-3.5" strokeWidth={3} />
              )}
            </span>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={dismiss}
              className="ml-2 -mr-1 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="알림 닫기"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </SettingsToastCtx.Provider>
  )
}
