import { Eye, EyeOff, Mail, Search, Send, Sparkles, TrendingUp } from "lucide-react"
import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { useTranslation } from "../../src/i18n/LanguageContext"
import { IconLoader, IconX } from "../Icons"
import { LanguageSwitcher } from "../LanguageSwitcher"

type AuthError = keyof ReturnType<typeof useTranslation>["login"]["errors"]

const isKnownAuthError = (
  value: string,
  errors: ReturnType<typeof useTranslation>["login"]["errors"],
): value is AuthError => {
  return value in errors
}

// Subtle animated background "agent" panel — gradient orb + flowing typing message
const AgentHero: React.FC = () => {
  const t = useTranslation()
  const messages = t.login.agent.messages
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const prevMessagesRef = useRef(messages)

  useEffect(() => {
    // Reset typing state when language (and therefore messages reference) changes
    if (prevMessagesRef.current !== messages) {
      prevMessagesRef.current = messages
      if (index !== 0 || displayed !== "") {
        setIndex(0)
        setDisplayed("")
        return
      }
    }
    const full = messages[index] ?? ""
    if (displayed.length < full.length) {
      const id = window.setTimeout(() => {
        setDisplayed(full.slice(0, displayed.length + 1))
      }, 32)
      return () => window.clearTimeout(id)
    }
    const hold = window.setTimeout(() => {
      setDisplayed("")
      setIndex((i) => (i + 1) % messages.length)
    }, 2600)
    return () => window.clearTimeout(hold)
  }, [displayed, index, messages])

  const capabilities = useMemo(
    () => [
      {
        icon: Search,
        title: t.login.capabilities.prospecting.title,
        desc: t.login.capabilities.prospecting.description,
      },
      {
        icon: TrendingUp,
        title: t.login.capabilities.research.title,
        desc: t.login.capabilities.research.description,
      },
      {
        icon: Send,
        title: t.login.capabilities.followup.title,
        desc: t.login.capabilities.followup.description,
      },
    ],
    [t],
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-white">
      {/* Ambient gradient orbs */}
      <div
        className="pointer-events-none absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.7), rgba(59,130,246,0.2) 50%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-16 w-[32rem] h-[32rem] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 60% 60%, rgba(168,85,247,0.6), rgba(236,72,153,0.15) 55%, transparent 75%)",
        }}
      />
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col h-full px-8 py-10 lg:px-12 lg:py-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">{t.common.appName}</span>
            <span className="text-xs font-semibold tracking-wider text-blue-300/90 bg-blue-500/15 border border-blue-400/30 rounded-md px-1.5 py-0.5">
              {t.common.alpha}
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="mt-12 lg:mt-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-blue-200/90 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            {t.login.badge}
          </div>
          <h2 className="mt-5 text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-[1.15] whitespace-pre-line">
            {t.login.heroHeadline}
          </h2>
          <p className="mt-5 text-base lg:text-lg text-slate-300/90 max-w-lg leading-relaxed">
            {t.login.heroSubline}
          </p>
        </div>

        {/* Agent typing card */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-4 lg:p-5 max-w-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
            </span>
            <span className="font-medium uppercase tracking-wider">{t.login.agent.thinking}</span>
          </div>
          <div className="mt-3 min-h-[2.5rem] text-sm lg:text-base text-white/95 font-medium leading-snug">
            {displayed}
            <span className="inline-block w-[2px] h-4 bg-blue-300 ml-0.5 align-[-2px] animate-pulse" />
          </div>
        </div>

        {/* Capabilities */}
        <div className="mt-auto pt-10 space-y-3 max-w-lg">
          {capabilities.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-400/20 flex items-center justify-center flex-shrink-0">
                <c.icon className="w-4 h-4 text-blue-300" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{c.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const LoginForm: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { login, register, loginWithGoogle } = useAuth()
  const t = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  // Handle OAuth error query params from callback redirects
  useEffect(() => {
    const urlError = searchParams.get("error")
    if (!urlError) return
    if (isKnownAuthError(urlError, t.login.errors)) {
      setError(t.login.errors[urlError])
    } else {
      setError(t.login.errors.generic)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError(t.login.errors.nameRequired)
          setLoading(false)
          return
        }
        const result = await register(email, password, name)
        if (!result.success) {
          setError(result.error || t.login.errors.registerFailed)
        } else {
          navigate("/dashboard", { replace: true })
        }
      } else {
        const result = await login(email, password)
        if (!result.success) {
          setError(result.error || t.login.errors.loginFailed)
        } else {
          navigate("/dashboard", { replace: true })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError("")
    try {
      await loginWithGoogle()
    } catch (_err) {
      setError(t.login.errors.googleFailed)
      setGoogleLoading(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp((v) => !v)
    setError("")
    setEmail("")
    setPassword("")
    setName("")
    setShowPassword(false)
  }

  const submitting = loading || googleLoading
  const submitLabel = loading
    ? isSignUp
      ? t.login.submittingSignUp
      : t.login.submittingSignIn
    : isSignUp
      ? t.login.submitSignUp
      : t.login.submitSignIn

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Hero / agent panel — desktop only, top header on mobile */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative">
        <AgentHero />
      </div>

      {/* Mobile compact brand bar */}
      <div className="lg:hidden relative overflow-hidden bg-slate-950 text-white px-5 pt-6 pb-8">
        <div
          className="pointer-events-none absolute -top-16 -right-10 w-72 h-72 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.7), rgba(168,85,247,0.2) 50%, transparent 75%)",
          }}
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">{t.common.appName}</span>
            <span className="text-[10px] font-semibold tracking-wider text-blue-200 bg-blue-500/20 border border-blue-400/30 rounded-md px-1.5 py-0.5">
              {t.common.alpha}
            </span>
          </div>
          <LanguageSwitcher variant="subtle" align="right" showLabel={false} />
        </div>
        <div className="relative mt-5">
          <h2 className="text-2xl font-bold leading-tight whitespace-pre-line">
            {t.login.heroHeadline}
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">{t.login.heroSubline}</p>
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 flex flex-col">
        {/* Top-right language switcher (desktop only — mobile shows in hero bar) */}
        <div className="hidden lg:flex justify-end px-6 pt-6">
          <LanguageSwitcher variant="outline" align="right" />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8 lg:px-8 lg:py-10">
          <div className="w-full max-w-md">
            {/* Headings */}
            <div className="text-center lg:text-left">
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                {isSignUp ? t.login.formTitleSignUp : t.login.formTitleSignIn}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {isSignUp ? t.login.formSubtitleSignUp : t.login.formSubtitleSignIn}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mt-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-3 animate-shake"
              >
                <IconX className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={submitting}
              type="button"
              className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-700 text-sm"
            >
              {googleLoading ? (
                <IconLoader className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>{t.login.googleLogin}</span>
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="px-3 bg-slate-50 text-slate-400 font-medium">{t.common.or}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-slate-700 mb-1.5">
                    {t.login.fields.name}
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    autoComplete="name"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition disabled:bg-slate-50"
                    placeholder={t.login.fields.namePlaceholder}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t.login.fields.email}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    autoComplete="email"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition disabled:bg-slate-50"
                    placeholder={t.login.fields.emailPlaceholder}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  {t.login.fields.password}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                    minLength={8}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition disabled:bg-slate-50"
                    placeholder={t.login.fields.passwordPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-slate-500 mt-1.5">{t.login.fields.passwordHint}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 px-4 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.99]"
              >
                {loading && <IconLoader className="w-4 h-4 animate-spin" />}
                {submitLabel}
              </button>
            </form>

            {/* Toggle */}
            <div className="mt-5 text-center text-sm">
              <span className="text-slate-500">
                {isSignUp ? t.login.toggleToSignIn : t.login.toggleToSignUp}
              </span>{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                {isSignUp ? t.login.toggleToSignInCta : t.login.toggleToSignUpCta}
              </button>
            </div>

            {/* Alpha notice */}
            <div className="mt-8 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-100 p-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider text-blue-700 bg-blue-100 border border-blue-200 rounded-md px-1.5 py-0.5">
                  {t.common.alpha}
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {t.login.alphaNotice.title}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {t.login.alphaNotice.body}
              </p>
            </div>

            {/* Legal */}
            <p className="mt-6 text-center text-[11px] text-slate-400 leading-relaxed">
              {t.login.legal.preamble}{" "}
              <span className="underline decoration-dotted hover:text-slate-600 cursor-pointer">
                {t.login.legal.terms}
              </span>{" "}
              {t.login.legal.and}{" "}
              <span className="underline decoration-dotted hover:text-slate-600 cursor-pointer">
                {t.login.legal.privacy}
              </span>
              {t.login.legal.acknowledge}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
