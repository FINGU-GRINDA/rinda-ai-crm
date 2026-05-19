import { Check, Globe } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useLanguage } from "../src/i18n/LanguageContext"
import type { Language } from "../src/i18n/types"

interface LanguageSwitcherProps {
  variant?: "ghost" | "subtle" | "outline"
  align?: "left" | "right"
  showLabel?: boolean
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = "ghost",
  align = "right",
  showLabel = true,
}) => {
  const { language, setLanguage, availableLanguages } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const current = availableLanguages.find((l) => l.code === language)

  const buttonClass = (() => {
    switch (variant) {
      case "outline":
        return "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
      case "subtle":
        return "bg-white/70 backdrop-blur-sm hover:bg-white text-slate-700 border border-slate-200/60"
      default:
        return "hover:bg-slate-100 text-slate-700"
    }
  })()

  const handleSelect = (lang: Language) => {
    setLanguage(lang)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${buttonClass}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
        {showLabel && <span>{current?.name}</span>}
        {!showLabel && <span className="text-xs font-semibold">{current?.short}</span>}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="listbox"
        >
          {availableLanguages.map((l) => {
            const selected = l.code === language
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelect(l.code)}
                role="option"
                aria-selected={selected}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${
                  selected ? "text-blue-700 bg-blue-50/60" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-slate-400 w-6">{l.short}</span>
                  <span className="font-medium">{l.name}</span>
                </span>
                {selected && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
