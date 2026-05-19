import { Sparkles } from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"
import { useTranslation } from "../src/i18n/LanguageContext"

interface AgenticLoaderProps {
  variant?: "full" | "page" | "inline"
  title?: string
  detail?: string
  showSteps?: boolean
}

/**
 * Branded, agentic loading screen.
 * - "full": full-screen with brand mark + rotating step narrative
 * - "page": flexible container fill
 * - "inline": compact, for in-card use
 */
export const AgenticLoader: React.FC<AgenticLoaderProps> = ({
  variant = "full",
  title,
  detail,
  showSteps = true,
}) => {
  const t = useTranslation()
  const steps = t.loader.steps
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    if (!showSteps || steps.length === 0) return
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % steps.length)
    }, 1600)
    return () => window.clearInterval(id)
  }, [showSteps, steps.length])

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3 text-slate-600">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        </div>
        <span className="text-sm font-medium">{title ?? t.common.loading}</span>
      </div>
    )
  }

  const containerClass =
    variant === "full"
      ? "fixed inset-0 z-50 bg-gradient-to-br from-slate-50 via-white to-blue-50/40"
      : "flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40"

  return (
    <div className={`${containerClass} flex flex-col items-center justify-center px-6`}>
      {/* Brand mark with breathing glow */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 opacity-40 blur-xl animate-pulse-subtle"
          aria-hidden="true"
        />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        {/* Orbit ring */}
        <div
          className="absolute -inset-3 rounded-full border-2 border-blue-200/60 border-t-blue-500 animate-spin"
          style={{ animationDuration: "1.6s" }}
          aria-hidden="true"
        />
      </div>

      {/* Brand label */}
      <div className="mt-7 flex items-center gap-2">
        <span className="text-base font-bold tracking-tight text-slate-800">
          {t.common.appName}
        </span>
        <span className="text-[10px] font-semibold tracking-wider text-blue-700 bg-blue-100 border border-blue-200 rounded-md px-1.5 py-0.5">
          {t.common.alpha}
        </span>
      </div>

      {/* Headline */}
      <p className="mt-3 text-sm font-medium text-slate-700">{title ?? t.loader.boot}</p>
      <p className="mt-1 text-xs text-slate-500 max-w-xs text-center leading-relaxed">
        {detail ?? t.loader.bootDetail}
      </p>

      {/* Rotating step narrative */}
      {showSteps && steps.length > 0 && (
        <div className="mt-6 h-5 overflow-hidden text-xs text-slate-600">
          <div
            className="flex flex-col transition-transform duration-500 ease-out"
            style={{ transform: `translateY(-${stepIdx * 1.25}rem)` }}
          >
            {steps.map((s, i) => (
              <span
                key={s}
                className={`h-5 flex items-center gap-2 ${
                  i === stepIdx ? "text-slate-700 font-medium" : "text-slate-400"
                }`}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-5 w-44 h-1 rounded-full bg-slate-200/70 overflow-hidden">
        <div
          className="h-full w-1/3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-shimmer"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, rgba(59,130,246,0.9), rgba(99,102,241,0.9), transparent)",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
    </div>
  )
}
