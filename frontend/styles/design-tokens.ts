/**
 * Design Tokens - RINDA CRM
 *
 * 전체 앱에서 사용하는 디자인 토큰을 중앙 관리합니다.
 */

export const colors = {
  // Primary: Single brand color (Blue)
  primary: {
    DEFAULT: '#2563EB',  // blue-600
    hover: '#1D4ED8',    // blue-700
    light: '#DBEAFE',    // blue-50
    dark: '#1E40AF',     // blue-800
  },

  // Neutral: Main UI colors (Slate)
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Semantic: Only when necessary
  success: '#10B981',   // Single green (emerald-500)
  warning: '#F59E0B',   // Single amber (amber-500)
  error: '#EF4444',     // Single red (red-500)

  // Accent: Minimal accent for special features
  accent: '#8B5CF6',    // Single purple (violet-500)
};

export const typography = {
  // Headings
  h1: 'text-3xl font-bold tracking-tight text-slate-900',
  h2: 'text-2xl font-bold tracking-tight text-slate-900',
  h3: 'text-xl font-semibold text-slate-800',
  h4: 'text-lg font-semibold text-slate-800',

  // Body
  body: 'text-sm text-slate-700 leading-relaxed',
  bodyLarge: 'text-base text-slate-700 leading-relaxed',
  bodySmall: 'text-xs text-slate-600',

  // Special
  label: 'text-xs font-medium text-slate-600 uppercase tracking-wide',
  caption: 'text-xs text-slate-500',
  code: 'font-mono text-sm bg-slate-100 px-1 py-0.5 rounded',
};

export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
};

export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};
