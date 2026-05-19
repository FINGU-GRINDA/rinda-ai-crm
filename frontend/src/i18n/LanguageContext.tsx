import type React from "react"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { safeGetItem, safeSetItem } from "../utils/safeStorage"
import { en } from "./locales/en"
import { ja } from "./locales/ja"
import { ko } from "./locales/ko"
import {
  type Language,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type TranslationDictionary,
} from "./types"

const DICTIONARIES: Record<Language, TranslationDictionary> = { ko, en, ja }

const LANGUAGE_HTML_LANG: Record<Language, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
}

interface LanguageOption {
  code: Language
  name: string
  short: string
}

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationDictionary
  availableLanguages: readonly LanguageOption[]
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as Language)
}

function detectInitialLanguage(): Language {
  const stored = safeGetItem<unknown>(LANGUAGE_STORAGE_KEY, null)
  if (isLanguage(stored)) return stored

  // Try browser language
  if (typeof navigator !== "undefined" && navigator.language) {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith("ko")) return "ko"
    if (lang.startsWith("ja")) return "ja"
    if (lang.startsWith("en")) return "en"
  }

  return "ko"
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => detectInitialLanguage())

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = LANGUAGE_HTML_LANG[language]
    }
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    safeSetItem(LANGUAGE_STORAGE_KEY, next)
  }, [])

  const value = useMemo<LanguageContextValue>(() => {
    const availableLanguages: LanguageOption[] = SUPPORTED_LANGUAGES.map((code) => ({
      code,
      name: DICTIONARIES[code].language.name,
      short: DICTIONARIES[code].language.short,
    }))
    return {
      language,
      setLanguage,
      t: DICTIONARIES[language],
      availableLanguages,
    }
  }, [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return ctx
}

export function useTranslation(): TranslationDictionary {
  return useLanguage().t
}
