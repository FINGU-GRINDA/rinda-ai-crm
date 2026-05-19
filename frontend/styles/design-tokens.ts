/**
 * Design Tokens - RINDA CRM
 *
 * 전체 앱에서 사용하는 디자인 토큰을 중앙 관리합니다.
 *
 * 사용 가능한 색상 패밀리(6종)에만 의존하세요:
 *   blue(주색·정보), slate(중립), emerald(성공), amber(주의/협상),
 *   red(위험/실주), violet(AI 단일 액센트)
 * indigo, purple, rose, fuchsia, green, sky, teal 등은 사용 금지.
 */

export const colors = {
  // Primary: Single brand color (Blue)
  primary: {
    DEFAULT: "#2563EB", // blue-600
    hover: "#1D4ED8", // blue-700
    light: "#DBEAFE", // blue-50
    dark: "#1E40AF", // blue-800
  },

  // Neutral: Main UI colors (Slate)
  neutral: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },

  // Semantic: Only when necessary
  success: "#10B981", // Single green (emerald-500)
  warning: "#F59E0B", // Single amber (amber-500)
  error: "#EF4444", // Single red (red-500)

  // Accent: Minimal accent for special features
  accent: "#8B5CF6", // Single violet (violet-500)
}

// ============================================================
// SEMANTIC TONE → 색상 매핑 (Badge, 상태 표시에 사용)
// ============================================================
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent"

export const toneStyles: Record<
  Tone,
  { bg: string; text: string; border: string; dot: string; borderLeft: string }
> = {
  neutral: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
    borderLeft: "border-l-slate-400",
  },
  info: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    borderLeft: "border-l-blue-500",
  },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    borderLeft: "border-l-emerald-500",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    borderLeft: "border-l-amber-500",
  },
  danger: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    borderLeft: "border-l-red-500",
  },
  accent: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
    borderLeft: "border-l-violet-500",
  },
}

// ============================================================
// 고객 상태 (CustomerStatus) 통일 매핑
// ============================================================
export type CustomerStatusKey = "prospect" | "new" | "contact" | "negotiation" | "won" | "lost"

export const statusBadge: Record<CustomerStatusKey, { label: string; tone: Tone }> = {
  prospect: { label: "잠재", tone: "accent" },
  new: { label: "신규", tone: "neutral" },
  contact: { label: "컨택 중", tone: "info" },
  negotiation: { label: "협상 중", tone: "warning" },
  won: { label: "성사", tone: "success" },
  lost: { label: "실주", tone: "danger" },
}

// ============================================================
// 우선순위 통일 매핑
// ============================================================
export type PriorityKey = "high" | "medium" | "low"

export const priorityBadge: Record<PriorityKey, { label: string; tone: Tone }> = {
  high: { label: "높음", tone: "danger" },
  medium: { label: "보통", tone: "warning" },
  low: { label: "낮음", tone: "neutral" },
}

// ============================================================
// 잠재 고객 신호 강도 매핑
// ============================================================
export type SignalKey = "high" | "medium" | "low"

export const signalBadge: Record<SignalKey, { label: string; description: string; tone: Tone }> = {
  high: { label: "강한 신호", description: "즉각 대응을 권장합니다", tone: "success" },
  medium: { label: "보통 신호", description: "지속 관찰을 권장합니다", tone: "info" },
  low: { label: "약한 신호", description: "참고 자료로 활용하세요", tone: "neutral" },
}

// ============================================================
// AI 표면 (단일 액센트, 그라데이션 금지)
// ============================================================
export const aiSurface = "bg-violet-50 border border-violet-100 text-violet-900"
export const aiAccentText = "text-violet-700"
export const aiAccentIconBg = "bg-violet-100"

// ============================================================
// 허용 그라데이션 (화이트 페이드만)
// ============================================================
export const allowedGradients = {
  heroSlate: "bg-gradient-to-b from-slate-50 to-white",
  heroBlue: "bg-gradient-to-b from-blue-50 to-white",
  emptyState: "bg-gradient-to-b from-slate-50 to-white",
} as const

export const typography = {
  // Headings
  h1: "text-3xl font-bold tracking-tight text-slate-900",
  h2: "text-2xl font-bold tracking-tight text-slate-900",
  h3: "text-xl font-semibold text-slate-800",
  h4: "text-lg font-semibold text-slate-800",

  // Body
  body: "text-sm text-slate-700 leading-relaxed",
  bodyLarge: "text-base text-slate-700 leading-relaxed",
  bodySmall: "text-xs text-slate-600",

  // Special
  label: "text-xs font-medium text-slate-600 uppercase tracking-wide",
  caption: "text-xs text-slate-500",
  code: "font-mono text-sm bg-slate-100 px-1 py-0.5 rounded",
}

export const spacing = {
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
  "3xl": "4rem", // 64px
  "4xl": "6rem", // 96px
}

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
}

export const borderRadius = {
  sm: "0.375rem", // 6px
  md: "0.5rem", // 8px
  lg: "0.75rem", // 12px
  xl: "1rem", // 16px
  "2xl": "1.5rem", // 24px
  full: "9999px",
}

export const transitions = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  slower: "500ms cubic-bezier(0.4, 0, 0.2, 1)",
}
