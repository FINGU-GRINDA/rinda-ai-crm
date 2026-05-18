// Shared Tailwind class tokens for the Settings modal.
// Palette is intentionally minimal: slate (neutral) + blue (brand) + emerald (success) + red (error).
// Do not introduce amber, yellow, blue accent, sky, purple, or gradients here.

export const card = "bg-white border border-slate-200 rounded-xl p-5";

export const sectionTitle = "text-base font-semibold text-slate-900";
export const sectionDesc = "text-sm text-slate-500 mt-0.5";

export const pageTitle = "text-lg font-semibold text-slate-900";
export const pageDesc = "text-sm text-slate-500 mt-1";

export const label = "block text-sm font-medium text-slate-700 mb-1.5";
export const helpText = "text-xs text-slate-500 mt-1";

export const infoNote =
  "bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600";

export const inputBase =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 transition-colors";

export const inputError =
  "border-red-300 focus:ring-red-500 focus:border-red-500";

export const inputValid =
  "border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnGhost =
  "inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50";

export const linkSubtle =
  "inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors";

export const successBanner =
  "flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800";

export const errorBanner =
  "flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800";

export const statusDot = (on: boolean): string =>
  `inline-block w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-slate-300"}`;

// Toggle (peer-based). Use with: <input type="checkbox" className="sr-only peer" /><div className={toggle} />
export const toggle =
  "w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600";

export const checkbox =
  "w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-offset-0";

export const divideRows = "divide-y divide-slate-100";

export const row =
  "flex items-center justify-between gap-4 px-5 py-4 first:rounded-t-xl last:rounded-b-xl";

export const chip =
  "inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium";

export const chipRemovable =
  "inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium";
