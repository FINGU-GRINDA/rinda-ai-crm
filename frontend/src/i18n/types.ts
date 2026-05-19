export type Language = "ko" | "en" | "ja"

export const SUPPORTED_LANGUAGES: readonly Language[] = ["ko", "en", "ja"] as const

export const LANGUAGE_STORAGE_KEY = "rinda_language"

export interface TranslationDictionary {
  language: {
    name: string
    short: string
  }
  common: {
    appName: string
    appFullName: string
    alpha: string
    loading: string
    loadingShort: string
    close: string
    cancel: string
    save: string
    saved: string
    confirm: string
    retry: string
    or: string
    continueWith: string
  }
  loader: {
    boot: string
    bootDetail: string
    finalizing: string
    steps: readonly string[]
  }
  login: {
    badge: string
    heroHeadline: string
    heroSubline: string
    capabilities: {
      prospecting: { title: string; description: string }
      research: { title: string; description: string }
      followup: { title: string; description: string }
    }
    formTitleSignIn: string
    formSubtitleSignIn: string
    formTitleSignUp: string
    formSubtitleSignUp: string
    fields: {
      name: string
      namePlaceholder: string
      email: string
      emailPlaceholder: string
      password: string
      passwordPlaceholder: string
      passwordHint: string
    }
    submitSignIn: string
    submitSignUp: string
    submittingSignIn: string
    submittingSignUp: string
    googleLogin: string
    toggleToSignUp: string
    toggleToSignUpCta: string
    toggleToSignIn: string
    toggleToSignInCta: string
    alphaNotice: {
      title: string
      body: string
    }
    legal: {
      preamble: string
      terms: string
      and: string
      privacy: string
      acknowledge: string
    }
    errors: {
      nameRequired: string
      registerFailed: string
      loginFailed: string
      googleFailed: string
      oauth_failed: string
      missing_code: string
      auth_failed: string
      callback_error: string
      state_mismatch: string
      verification_failed: string
      generic: string
    }
    agent: {
      thinking: string
      messages: readonly string[]
    }
  }
  authCallback: {
    verifying: string
    detail: string
    redirecting: string
  }
  header: {
    tagline: string
    searchPlaceholder: string
    allIndustries: string
    addCustomer: string
    addCustomerAria: string
    addCustomerTooltip: string
    businessCard: string
    meetingRecord: string
    statsToggle: string
    settings: string
  }
  profile: {
    profile: string
    logout: string
    user: string
  }
  stats: {
    totalCustomers: string
    aiAnalyzed: string
    proposals: string
    won: string
    prospects: string
    lastCollection: string
  }
  settingsShell: {
    title: string
    subtitle: string
    autoSave: string
    language: string
    languageDescription: string
  }
}
