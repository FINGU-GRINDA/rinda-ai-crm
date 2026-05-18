import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  type CollectionSettings,
  type CollectionStatus,
  getCollectionSettings,
  getCollectionStatus,
  getICPProfiles,
  runProspectCollection,
  saveCollectionSettings,
  saveICPProfiles,
} from "../services/prospectService"
import type { ICPProfile, Prospect } from "../types"
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconClock,
  IconExternalLink,
  IconLightbulb,
  IconLoader,
  IconNews,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconX,
} from "./Icons"

interface ProspectDiscoveryProps {
  prospects: Prospect[]
  existingCompanyNames: string[]
  onConvertProspect: (prospectId: string) => void
  onDismissProspect: (prospectId: string) => void
  onProspectsChanged: () => Promise<void> | void
}

// Preset suggestions tailored to Korean export companies
const PRESET_INDUSTRIES = [
  "뷰티/화장품",
  "식품/F&B",
  "패션/의류",
  "전자/IT부품",
  "기계/장비",
  "자동차부품",
  "의료기기",
  "농수산물",
  "K-콘텐츠/굿즈",
  "리빙/생활용품",
]

interface RegionPreset {
  name: string
  flag: string
}
const PRESET_REGIONS: RegionPreset[] = [
  { name: "미국", flag: "🇺🇸" },
  { name: "일본", flag: "🇯🇵" },
  { name: "중국", flag: "🇨🇳" },
  { name: "베트남", flag: "🇻🇳" },
  { name: "인도네시아", flag: "🇮🇩" },
  { name: "태국", flag: "🇹🇭" },
  { name: "말레이시아", flag: "🇲🇾" },
  { name: "싱가포르", flag: "🇸🇬" },
  { name: "인도", flag: "🇮🇳" },
  { name: "유럽(EU)", flag: "🇪🇺" },
  { name: "중동(UAE)", flag: "🇦🇪" },
  { name: "브라질", flag: "🇧🇷" },
  { name: "멕시코", flag: "🇲🇽" },
  { name: "호주", flag: "🇦🇺" },
]

const REGION_FLAGS: Record<string, string> = PRESET_REGIONS.reduce(
  (acc, r) => ({ ...acc, [r.name]: r.flag }),
  {} as Record<string, string>,
)

// Heuristic: guess a flag from a free-form region/country string
const FLAG_HINTS: Array<[RegExp, string]> = [
  [/usa|미국|united states|america/i, "🇺🇸"],
  [/일본|japan/i, "🇯🇵"],
  [/중국|china|prc/i, "🇨🇳"],
  [/베트남|vietnam/i, "🇻🇳"],
  [/인도네시아|indonesia/i, "🇮🇩"],
  [/태국|thai/i, "🇹🇭"],
  [/말레이시아|malaysia/i, "🇲🇾"],
  [/싱가포르|singapore/i, "🇸🇬"],
  [/인도\b|india/i, "🇮🇳"],
  [/유럽|europe|eu\b/i, "🇪🇺"],
  [/uae|두바이|아랍|중동|dubai|emirate/i, "🇦🇪"],
  [/브라질|brazil/i, "🇧🇷"],
  [/멕시코|mexico/i, "🇲🇽"],
  [/호주|australia/i, "🇦🇺"],
  [/캐나다|canada/i, "🇨🇦"],
  [/영국|britain|uk\b|united kingdom/i, "🇬🇧"],
  [/독일|germany/i, "🇩🇪"],
  [/프랑스|france/i, "🇫🇷"],
  [/대만|taiwan/i, "🇹🇼"],
  [/홍콩|hong kong/i, "🇭🇰"],
  [/필리핀|philippines/i, "🇵🇭"],
  [/사우디|saudi/i, "🇸🇦"],
]

const guessFlag = (text?: string): string => {
  if (!text) return "🌐"
  if (REGION_FLAGS[text]) return REGION_FLAGS[text]
  for (const [re, flag] of FLAG_HINTS) {
    if (re.test(text)) return flag
  }
  return "🌐"
}

const COMPANY_SIZE_OPTIONS = [
  { value: "", label: "제한 없음" },
  { value: "소규모 (1-50명)", label: "소규모 (1-50명)" },
  { value: "중견 (51-500명)", label: "중견 (51-500명)" },
  { value: "대기업 (500명+)", label: "대기업 (500명+)" },
]

const INTERVAL_OPTIONS = [
  { value: 3600000, label: "1시간마다" },
  { value: 21600000, label: "6시간마다" },
  { value: 43200000, label: "12시간마다" },
  { value: 86400000, label: "24시간마다" },
]

const SIGNAL_META = {
  high: {
    label: "강한 신호",
    description: "즉시 접촉 권장",
    icon: "🔥",
    chip: "bg-red-100 text-red-700 border-red-200",
  },
  medium: {
    label: "중간 신호",
    description: "모니터링 가치",
    icon: "⚡",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
  },
  low: {
    label: "약한 신호",
    description: "장기 후보",
    icon: "🌱",
    chip: "bg-slate-100 text-slate-600 border-slate-200",
  },
} as const

const DISCOVERY_STAGES = [
  { label: "ICP 분석", sub: "내 이상 바이어 기준을 정리하고 있어요" },
  { label: "해외 시장 스캔", sub: "대상 국가/산업의 최근 신호를 살피는 중" },
  { label: "바이어 후보 큐레이션", sub: "구매 신호 기반으로 매칭 평가" },
  { label: "결과 저장", sub: "중복 제거 후 파이프라인에 등록" },
]

const formatRelative = (iso: string): string => {
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ""
  const diffMs = Date.now() - ts
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "방금 전"
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(diffMs / 86400000)
  if (days < 7) return `${days}일 전`
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
}

const generateId = () => `icp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

type SortMode = "recent" | "signal" | "name"

interface ICPFormState {
  id: string | null
  name: string
  industries: string[]
  keywords: string[]
  companySize: string
  targetRegions: string[]
}

const blankForm = (): ICPFormState => ({
  id: null,
  name: "",
  industries: [],
  keywords: [],
  companySize: "",
  targetRegions: [],
})

// Field-level form errors so we can highlight the right input rather than a single global alert
type FormErrors = Partial<Record<"name" | "industries" | "keywords" | "targetRegions", string>>

// Lightweight toast system (inline; no external dep)
type ToastTone = "success" | "error" | "info"
interface Toast {
  id: string
  tone: ToastTone
  message: string
}

// Confirm dialog state
interface ConfirmState {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  destructive: boolean
  onConfirm: () => void
}

export const ProspectDiscovery: React.FC<ProspectDiscoveryProps> = ({
  prospects,
  existingCompanyNames,
  onConvertProspect,
  onDismissProspect,
  onProspectsChanged,
}) => {
  const [icpProfiles, setIcpProfiles] = useState<ICPProfile[]>(() => getICPProfiles())
  const [settings, setSettings] = useState<CollectionSettings>(() => getCollectionSettings())
  const [status, setStatus] = useState<CollectionStatus | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [runSummary, setRunSummary] = useState<string | null>(null)
  const [lastRunStats, setLastRunStats] = useState<{
    created: number
    skipped: number
    analyzed: number
  } | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const [form, setForm] = useState<ICPFormState>(blankForm())
  const [keywordInput, setKeywordInput] = useState("")
  const [industryInput, setIndustryInput] = useState("")
  const [regionInput, setRegionInput] = useState("")
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  const [selectedProfileId, setSelectedProfileId] = useState<string>("all")
  const [signalFilter, setSignalFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("signal")
  const [visibleCount, setVisibleCount] = useState(20)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  // Toast helpers
  const pushToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  // Animate discovery stage indicator while running
  useEffect(() => {
    if (isRunning) {
      setStageIndex(0)
      stageTimerRef.current = setInterval(() => {
        setStageIndex((s) => (s < DISCOVERY_STAGES.length - 1 ? s + 1 : s))
      }, 3500)
    } else {
      if (stageTimerRef.current) {
        clearInterval(stageTimerRef.current)
        stageTimerRef.current = null
      }
    }
    return () => {
      if (stageTimerRef.current) {
        clearInterval(stageTimerRef.current)
        stageTimerRef.current = null
      }
    }
  }, [isRunning])

  // Poll backend status occasionally so we reflect background scheduler runs
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const s = await getCollectionStatus()
      if (!cancelled) setStatus(s)
    }
    tick()
    const interval = setInterval(tick, isRunning ? 2000 : 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isRunning])

  const stats = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 }
    for (const p of prospects) {
      counts[p.signalStrength] += 1
    }
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const newThisWeek = prospects.filter(
      (p) => now - new Date(p.detectedAt).getTime() < oneWeek,
    ).length
    return { total: prospects.length, newThisWeek, ...counts }
  }, [prospects])

  const filteredProspects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const sortFn = (() => {
      if (sortMode === "recent") {
        return (a: Prospect, b: Prospect) =>
          new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      }
      if (sortMode === "name") {
        return (a: Prospect, b: Prospect) => a.companyName.localeCompare(b.companyName, "ko")
      }
      // signal
      const order = { high: 0, medium: 1, low: 2 } as const
      return (a: Prospect, b: Prospect) => {
        const diff = order[a.signalStrength] - order[b.signalStrength]
        if (diff !== 0) return diff
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      }
    })()

    return prospects
      .filter((p) => selectedProfileId === "all" || p.icpMatch === selectedProfileId)
      .filter((p) => signalFilter === "all" || p.signalStrength === signalFilter)
      .filter((p) => {
        if (!q) return true
        return (
          p.companyName.toLowerCase().includes(q) ||
          (p.industry || "").toLowerCase().includes(q) ||
          (p.notes || "").toLowerCase().includes(q)
        )
      })
      .sort(sortFn)
  }, [prospects, selectedProfileId, signalFilter, searchQuery, sortMode])

  // Reset visible window when filters change
  useEffect(() => {
    setVisibleCount(20)
  }, [])

  const visibleProspects = useMemo(
    () => filteredProspects.slice(0, visibleCount),
    [filteredProspects, visibleCount],
  )

  const persistProfiles = useCallback((next: ICPProfile[]) => {
    setIcpProfiles(next)
    saveICPProfiles(next)
  }, [])

  const persistSettings = useCallback(
    (updates: Partial<CollectionSettings>) => {
      const next = { ...settings, ...updates }
      setSettings(next)
      saveCollectionSettings(next)
    },
    [settings],
  )

  const openEditorForNew = () => {
    setForm(blankForm())
    setKeywordInput("")
    setIndustryInput("")
    setRegionInput("")
    setFormErrors({})
    setShowProfileEditor(true)
  }

  const openEditorForEdit = (profile: ICPProfile) => {
    setForm({
      id: profile.id,
      name: profile.name,
      industries: [...profile.industries],
      keywords: [...profile.keywords],
      companySize: profile.companySize ?? "",
      targetRegions: [...(profile.targetRegions ?? [])],
    })
    setKeywordInput("")
    setIndustryInput("")
    setRegionInput("")
    setFormErrors({})
    setShowProfileEditor(true)
  }

  const closeEditor = () => {
    setShowProfileEditor(false)
    setFormErrors({})
  }

  const addToList = (key: "industries" | "keywords" | "targetRegions", value: string) => {
    const cleaned = value.trim()
    if (!cleaned) return
    setForm((prev) => {
      if (prev[key].includes(cleaned)) return prev
      return { ...prev, [key]: [...prev[key], cleaned] }
    })
    setFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const removeFromList = (key: "industries" | "keywords" | "targetRegions", value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((v) => v !== value),
    }))
  }

  const validateForm = (state: ICPFormState): FormErrors => {
    const errors: FormErrors = {}
    if (!state.name.trim()) errors.name = "프로필 이름을 입력해주세요."
    if (state.industries.length === 0) errors.industries = "최소 한 가지 산업을 추가해주세요."
    if (state.keywords.length === 0) errors.keywords = "최소 한 가지 키워드를 추가해주세요."
    if (state.targetRegions.length === 0)
      errors.targetRegions = "수출 대상국을 최소 하나 선택해주세요."
    return errors
  }

  const handleSaveProfile = () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const now = new Date().toISOString()
    let next: ICPProfile[]
    if (form.id) {
      next = icpProfiles.map((p) =>
        p.id === form.id
          ? {
              ...p,
              name: form.name.trim(),
              industries: form.industries,
              keywords: form.keywords,
              companySize: form.companySize || undefined,
              targetRegions: form.targetRegions,
              updatedAt: now,
            }
          : p,
      )
      pushToast("ICP 프로필을 수정했어요", "success")
    } else {
      const newProfile: ICPProfile = {
        id: generateId(),
        name: form.name.trim(),
        industries: form.industries,
        keywords: form.keywords,
        companySize: form.companySize || undefined,
        targetRegions: form.targetRegions,
        createdAt: now,
        updatedAt: now,
      }
      next = [newProfile, ...icpProfiles]
      pushToast('새 ICP 프로필이 추가됐어요. 이제 "지금 바이어 발굴 실행"을 눌러보세요!', "success")
    }
    persistProfiles(next)
    closeEditor()
  }

  const handleDeleteProfile = (profile: ICPProfile) => {
    setConfirmState({
      open: true,
      title: "ICP 프로필을 삭제할까요?",
      description: `"${profile.name}" 프로필을 삭제합니다. 이미 수집된 잠재 바이어는 그대로 유지됩니다.`,
      confirmLabel: "삭제",
      destructive: true,
      onConfirm: () => {
        persistProfiles(icpProfiles.filter((p) => p.id !== profile.id))
        if (selectedProfileId === profile.id) setSelectedProfileId("all")
        setConfirmState(null)
        pushToast("ICP 프로필을 삭제했어요", "info")
      },
    })
  }

  const handleRunDiscovery = async () => {
    if (icpProfiles.length === 0) {
      setRunError("먼저 ICP 프로필을 추가해주세요.")
      pushToast("먼저 ICP 프로필을 추가해주세요", "error")
      return
    }
    setIsRunning(true)
    setRunError(null)
    setRunSummary(null)
    try {
      const result = await runProspectCollection(existingCompanyNames)
      setLastRunStats({
        created: result.newProspects.length,
        skipped: result.skipped,
        analyzed: result.totalArticles,
      })
      setRunSummary(result.summary || null)
      await onProspectsChanged()
      // Refresh latest status after run
      const fresh = await getCollectionStatus()
      setStatus(fresh)
      if (result.newProspects.length > 0) {
        pushToast(`${result.newProspects.length}개의 새 바이어를 발견했어요`, "success")
      } else if (result.totalArticles === 0) {
        pushToast("이번 라운드에서 새 후보가 발견되지 않았어요", "info")
      } else {
        pushToast("AI 제안 후보가 모두 이미 파이프라인에 있었어요", "info")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "잠재 고객 수집에 실패했습니다."
      setRunError(message)
      pushToast(message, "error")
    } finally {
      setIsRunning(false)
    }
  }

  const hasProfiles = icpProfiles.length > 0

  return (
    <div className="h-full flex flex-col relative">
      {/* Hero / Overview */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
              <IconSparkles className="h-3.5 w-3.5" />
              AI 해외 바이어 발굴
              {(isRunning || status?.isRunning) && (
                <span className="ml-1 inline-flex items-center gap-1">
                  <span className="relative inline-flex">
                    <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                  <span className="text-[11px]">실행 중</span>
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold md:text-3xl">발굴 고객</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">
              우리 ICP에 맞는 해외 바이어를 AI가 매일 찾아드립니다.
              <br />
              수출 대상국·산업·키워드만 정의하면, 우리가 컨택할 가치가 있는 기업을 자동으로
              큐레이션합니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:flex md:gap-4">
            <StatCard label="총 발굴" value={stats.total} />
            <StatCard label="이번 주 신규" value={stats.newThisWeek} highlight />
            <StatCard label="강한 신호" value={stats.high} accent="🔥" />
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* ICP profiles card */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <IconLightbulb className="h-5 w-5 text-amber-500" />내 ICP 프로필
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                AI가 이 기준에 따라 해외 잠재 바이어를 찾습니다.
              </p>
            </div>
            <button
              onClick={openEditorForNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <IconPlus className="h-4 w-4" />
              ICP 추가
            </button>
          </div>

          {!hasProfiles ? (
            <EmptyICP onAdd={openEditorForNew} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {icpProfiles.map((profile) => (
                <ICPCard
                  key={profile.id}
                  profile={profile}
                  matchedCount={prospects.filter((p) => p.icpMatch === profile.id).length}
                  onEdit={() => openEditorForEdit(profile)}
                  onDelete={() => handleDeleteProfile(profile)}
                  onSelect={() => setSelectedProfileId(profile.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Discovery actions card */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <IconSparkles className="h-5 w-5 text-indigo-500" />
            AI 발굴 실행
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            지금 즉시 또는 자동 주기로 새로운 해외 바이어를 수집합니다.
          </p>

          <button
            onClick={handleRunDiscovery}
            disabled={isRunning || !hasProfiles}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:from-indigo-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <IconLoader className="h-4 w-4 animate-spin" />
                AI 바이어 발굴 중...
              </>
            ) : (
              <>
                <IconPlay className="h-4 w-4" />
                지금 바이어 발굴 실행
              </>
            )}
          </button>

          {!hasProfiles && (
            <p className="mt-2 text-center text-xs text-slate-500">
              ICP 프로필을 먼저 추가해주세요
            </p>
          )}

          {/* Stage progress */}
          {isRunning && (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="space-y-1.5">
                {DISCOVERY_STAGES.map((stage, idx) => {
                  const state =
                    idx < stageIndex ? "done" : idx === stageIndex ? "active" : "pending"
                  return (
                    <div key={stage.label} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                          state === "done"
                            ? "bg-emerald-500 text-white"
                            : state === "active"
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {state === "done" ? "✓" : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`font-medium ${
                            state === "pending" ? "text-slate-500" : "text-slate-800"
                          }`}
                        >
                          {stage.label}
                          {state === "active" && (
                            <span className="ml-1 inline-flex items-center gap-0.5">
                              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-indigo-500 [animation-delay:0ms]" />
                              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-indigo-500 [animation-delay:150ms]" />
                              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-indigo-500 [animation-delay:300ms]" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{stage.sub}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!isRunning && runError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <div className="font-semibold">발굴 실패</div>
              <div className="mt-0.5">{runError}</div>
              <button
                onClick={handleRunDiscovery}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700"
              >
                <IconRefresh className="h-3 w-3" />
                다시 시도
              </button>
            </div>
          )}

          {!isRunning && lastRunStats && !runError && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <div className="flex items-center gap-1.5 font-semibold">
                <IconCheck className="h-3.5 w-3.5" />
                최근 발굴 완료
              </div>
              <div className="mt-1">
                {lastRunStats.analyzed}개 후보 분석 ·{" "}
                <span className="font-semibold">신규 {lastRunStats.created}개</span>
                {lastRunStats.skipped > 0 ? ` · 중복 ${lastRunStats.skipped}개 제외` : ""}
              </div>
              {runSummary && <div className="mt-1.5 text-emerald-700">{runSummary}</div>}
            </div>
          )}

          {/* Auto-run controls */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-800">자동 발굴</div>
                <div className="text-xs text-slate-500">설정된 주기마다 백그라운드 실행</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={settings.autoRun}
                  onChange={(e) => persistSettings({ autoRun: e.target.checked })}
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">주기</label>
              <select
                value={settings.interval}
                onChange={(e) => persistSettings({ interval: parseInt(e.target.value, 10) })}
                disabled={!settings.autoRun}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {status?.finishedAt && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <IconClock className="h-3 w-3" />
                마지막 실행: {formatRelative(new Date(status.finishedAt).toISOString())}
              </div>
            )}
            {status?.lastError && !isRunning && (
              <div className="mt-2 text-xs text-red-600">
                ⚠ 최근 백그라운드 실행 오류: {status.lastError}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Filters + Search row */}
      {prospects.length > 0 && (
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">ICP</span>
            <FilterChip
              active={selectedProfileId === "all"}
              onClick={() => setSelectedProfileId("all")}
            >
              전체 ({prospects.length})
            </FilterChip>
            {icpProfiles.map((p) => {
              const count = prospects.filter((pr) => pr.icpMatch === p.id).length
              return (
                <FilterChip
                  key={p.id}
                  active={selectedProfileId === p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                >
                  {p.name} ({count})
                </FilterChip>
              )
            })}
            <div className="mx-1 h-5 w-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-500">신호</span>
            {(["all", "high", "medium", "low"] as const).map((s) => (
              <FilterChip key={s} active={signalFilter === s} onClick={() => setSignalFilter(s)}>
                {s === "all" ? "모두" : SIGNAL_META[s].label}
              </FilterChip>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="회사명, 산업, 메모 검색"
                className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-7 pr-7 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="검색어 지우기"
                >
                  <IconX className="h-3 w-3" />
                </button>
              )}
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="signal">신호 강도순</option>
              <option value="recent">최신순</option>
              <option value="name">회사명순</option>
            </select>
          </div>
        </div>
      )}

      {/* Prospects list */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40">
        {prospects.length === 0 ? (
          <EmptyProspects
            hasProfiles={hasProfiles}
            onAdd={openEditorForNew}
            onRun={handleRunDiscovery}
            isRunning={isRunning}
          />
        ) : filteredProspects.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="text-3xl">🔍</div>
            <p className="mt-2 text-sm font-medium text-slate-700">
              필터에 해당하는 잠재 고객이 없습니다
            </p>
            <button
              onClick={() => {
                setSelectedProfileId("all")
                setSignalFilter("all")
                setSearchQuery("")
              }}
              className="mt-3 text-xs font-medium text-blue-600 hover:underline"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-200">
              {visibleProspects.map((prospect) => (
                <ProspectRow
                  key={prospect.id}
                  prospect={prospect}
                  profileName={icpProfiles.find((p) => p.id === prospect.icpMatch)?.name}
                  onClick={() => setSelectedProspect(prospect)}
                  onConvert={() => {
                    onConvertProspect(prospect.id)
                  }}
                  onDismiss={() => {
                    onDismissProspect(prospect.id)
                  }}
                />
              ))}
            </ul>
            {visibleCount < filteredProspects.length && (
              <div className="border-t border-slate-200 bg-white px-4 py-3 text-center">
                <button
                  onClick={() => setVisibleCount((v) => v + 20)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  더 보기 ({filteredProspects.length - visibleCount}개 남음)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {form.id ? "ICP 프로필 수정" : "새 ICP 프로필 만들기"}
                </h3>
                <p className="text-xs text-slate-500">
                  AI가 이 기준에 부합하는 해외 바이어를 찾습니다.
                </p>
              </div>
              <button
                onClick={closeEditor}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="닫기"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  프로필 이름 *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value })
                    if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined }))
                  }}
                  placeholder="예: 베트남 식품 바이어, 미국 K-뷰티 리테일러"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                    formErrors.name
                      ? "border-red-300 focus:ring-red-500"
                      : "border-slate-300 focus:ring-blue-500"
                  }`}
                  aria-invalid={!!formErrors.name}
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>

              <TagsEditor
                label="수출 대상국/지역 *"
                helperText="우리 제품을 수출할 목표 시장 (복수 선택 가능)"
                value={form.targetRegions}
                input={regionInput}
                onChangeInput={setRegionInput}
                onAdd={(v) => {
                  addToList("targetRegions", v)
                  setRegionInput("")
                }}
                onRemove={(v) => removeFromList("targetRegions", v)}
                presets={PRESET_REGIONS.map((r) => `${r.flag} ${r.name}`)}
                renderTagPrefix={(v) => guessFlag(v.replace(/^\W+\s*/, ""))}
                onAddPreset={(preset) => {
                  // Strip flag prefix when adding from preset list
                  const cleaned = preset.replace(/^\W+\s*/, "")
                  addToList("targetRegions", cleaned)
                }}
                tone="indigo"
                error={formErrors.targetRegions}
                placeholder="국가/지역 입력 후 Enter (예: 일본, 베트남)"
              />

              <TagsEditor
                label="산업 분야 *"
                helperText="우리가 만드는 제품이 속하는 산업"
                value={form.industries}
                input={industryInput}
                onChangeInput={setIndustryInput}
                onAdd={(v) => {
                  addToList("industries", v)
                  setIndustryInput("")
                }}
                onRemove={(v) => removeFromList("industries", v)}
                presets={PRESET_INDUSTRIES}
                onAddPreset={(p) => addToList("industries", p)}
                tone="blue"
                error={formErrors.industries}
                placeholder="산업 입력 후 Enter (예: 뷰티/화장품)"
              />

              <TagsEditor
                label="제품/사업 키워드 *"
                helperText="제품이나 사업의 핵심 키워드. 더 구체적일수록 발굴 정확도가 올라갑니다."
                value={form.keywords}
                input={keywordInput}
                onChangeInput={setKeywordInput}
                onAdd={(v) => {
                  v.split(",").forEach((token) => {
                    addToList("keywords", token)
                  })
                  setKeywordInput("")
                }}
                onRemove={(v) => removeFromList("keywords", v)}
                tone="violet"
                error={formErrors.keywords}
                placeholder="키워드 입력 후 Enter (예: 마스크팩, 비건, OEM)"
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  바이어 규모 (선택)
                </label>
                <select
                  value={form.companySize}
                  onChange={(e) => setForm({ ...form, companySize: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COMPANY_SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
              <button
                onClick={closeEditor}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <IconCheck className="h-4 w-4" />
                {form.id ? "변경 사항 저장" : "프로필 만들기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prospect Detail Drawer */}
      {selectedProspect && (
        <ProspectDetailDrawer
          prospect={selectedProspect}
          profileName={icpProfiles.find((p) => p.id === selectedProspect.icpMatch)?.name}
          onClose={() => setSelectedProspect(null)}
          onConvert={() => {
            onConvertProspect(selectedProspect.id)
            setSelectedProspect(null)
          }}
          onDismiss={() => {
            onDismissProspect(selectedProspect.id)
            setSelectedProspect(null)
          }}
        />
      )}

      {/* Confirm Dialog */}
      {confirmState?.open && (
        <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      )}

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

// -------------------- Sub-components --------------------

const StatCard: React.FC<{
  label: string
  value: number
  highlight?: boolean
  accent?: string
}> = ({ label, value, highlight, accent }) => (
  <div
    className={`min-w-[88px] rounded-lg px-4 py-3 backdrop-blur ${
      highlight ? "bg-white/20 ring-1 ring-white/30" : "bg-white/10"
    }`}
  >
    <div className="text-xs text-blue-50/90">{label}</div>
    <div className="mt-0.5 flex items-baseline gap-1 text-2xl font-bold">
      {value}
      {accent && <span className="text-sm">{accent}</span>}
    </div>
  </div>
)

const EmptyICP: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
    <div className="text-3xl">🎯</div>
    <h3 className="mt-2 text-sm font-semibold text-slate-800">
      먼저 우리의 이상적인 바이어를 정의해주세요
    </h3>
    <p className="mt-1 text-xs text-slate-500">
      ICP(Ideal Customer Profile)는 AI가 정확한 해외 바이어를 찾는 기준이 됩니다.
    </p>
    <button
      onClick={onAdd}
      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      <IconPlus className="h-4 w-4" />첫 ICP 프로필 만들기
    </button>
  </div>
)

const EmptyProspects: React.FC<{
  hasProfiles: boolean
  onAdd: () => void
  onRun: () => void
  isRunning: boolean
}> = ({ hasProfiles, onAdd, onRun, isRunning }) => (
  <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
    <div className="text-5xl">{hasProfiles ? "🚀" : "🧭"}</div>
    <h3 className="mt-3 text-lg font-semibold text-slate-800">
      {hasProfiles ? "아직 발굴된 바이어가 없습니다" : "ICP 설정으로 발굴을 시작하세요"}
    </h3>
    <p className="mt-1 max-w-md text-sm text-slate-500">
      {hasProfiles
        ? '오른쪽 상단 "지금 바이어 발굴 실행" 버튼을 누르면 AI가 해외 잠재 바이어를 찾아드립니다.'
        : "수출 대상국과 산업·키워드만 정의하면 우리 제품에 관심 가질 해외 기업을 자동으로 큐레이션합니다."}
    </p>
    {hasProfiles ? (
      <button
        onClick={onRun}
        disabled={isRunning}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isRunning ? (
          <IconLoader className="h-4 w-4 animate-spin" />
        ) : (
          <IconPlay className="h-4 w-4" />
        )}
        지금 발굴 실행
      </button>
    ) : (
      <button
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <IconPlus className="h-4 w-4" />첫 ICP 프로필 만들기
      </button>
    )}
  </div>
)

const ICPCard: React.FC<{
  profile: ICPProfile
  matchedCount: number
  onEdit: () => void
  onDelete: () => void
  onSelect: () => void
}> = ({ profile, matchedCount, onEdit, onDelete, onSelect }) => (
  <div className="group rounded-lg border border-slate-200 bg-slate-50/60 p-4 hover:border-blue-300 hover:bg-white">
    <div className="flex items-start justify-between gap-2">
      <button onClick={onSelect} className="min-w-0 flex-1 text-left" title="이 ICP로 결과 필터링">
        <h4 className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
          {profile.name}
        </h4>
        <div className="mt-0.5 text-xs text-slate-500">
          매칭된 바이어 <span className="font-semibold text-blue-600">{matchedCount}</span>개
        </div>
      </button>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={onEdit}
          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          aria-label="수정"
          title="수정"
        >
          <IconRefresh className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-600"
          aria-label="삭제"
          title="삭제"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    <div className="mt-3 space-y-1.5 text-xs">
      {profile.targetRegions && profile.targetRegions.length > 0 && (
        <div className="flex gap-1.5 text-slate-600">
          <span aria-hidden>🌏</span>
          <div className="min-w-0 flex-1">
            <span className="text-slate-400">대상국: </span>
            <span className="text-slate-700">
              {profile.targetRegions.map((r) => `${guessFlag(r)} ${r}`).join(" · ")}
            </span>
          </div>
        </div>
      )}
      <CardRow icon="🏷" label="산업" value={profile.industries.join(", ")} />
      <CardRow icon="🔑" label="키워드" value={profile.keywords.join(", ")} />
      {profile.companySize && <CardRow icon="🏢" label="규모" value={profile.companySize} />}
    </div>
  </div>
)

const CardRow: React.FC<{ icon: string; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex gap-1.5 text-slate-600">
    <span aria-hidden>{icon}</span>
    <div className="min-w-0 flex-1">
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700">{value}</span>
    </div>
  </div>
)

const FilterChip: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`}
  >
    {children}
  </button>
)

const ProspectRow: React.FC<{
  prospect: Prospect
  profileName?: string
  onClick: () => void
  onConvert: () => void
  onDismiss: () => void
}> = ({ prospect, profileName, onClick, onConvert, onDismiss }) => {
  const meta = SIGNAL_META[prospect.signalStrength]
  return (
    <li
      onClick={onClick}
      className="cursor-pointer bg-white px-4 py-4 transition-colors hover:bg-slate-50 md:px-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-base ${meta.chip}`}
              aria-hidden
            >
              {meta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-base font-semibold text-slate-900">
                  {prospect.companyName}
                </h4>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
                >
                  {meta.label}
                </span>
                {profileName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                    <IconLightbulb className="h-3 w-3" />
                    {profileName}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {prospect.industry && prospect.industry !== "미분류" && (
                  <span className="inline-flex items-center gap-1">
                    <IconBuilding className="h-3 w-3" /> {prospect.industry}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <IconClock className="h-3 w-3" />
                  {formatRelative(prospect.detectedAt)} 발굴
                </span>
                {prospect.website && (
                  <a
                    href={
                      prospect.website.startsWith("http")
                        ? prospect.website
                        : `https://${prospect.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <IconExternalLink className="h-3 w-3" />
                    {prospect.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
              </div>
              {prospect.notes && (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                  {prospect.notes}
                </p>
              )}
              {prospect.sourceArticle?.title && (
                <div className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                  <IconNews className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <span className="line-clamp-1">{prospect.sourceArticle.title}</span>
                    {prospect.sourceArticle.uri && (
                      <a
                        href={prospect.sourceArticle.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-1 text-blue-600 hover:underline"
                      >
                        원문 →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 md:flex-col md:items-stretch">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConvert()
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconArrowRight className="h-3.5 w-3.5" />
            고객으로 전환
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <IconX className="h-3.5 w-3.5" />
            관심 없음
          </button>
        </div>
      </div>
    </li>
  )
}

const ProspectDetailDrawer: React.FC<{
  prospect: Prospect
  profileName?: string
  onClose: () => void
  onConvert: () => void
  onDismiss: () => void
}> = ({ prospect, profileName, onClose, onConvert, onDismiss }) => {
  const meta = SIGNAL_META[prospect.signalStrength]

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-[slideIn_0.2s_ease-out]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm ${meta.chip}`}
              >
                {meta.icon}
              </span>
              <h3 className="truncate text-lg font-bold text-slate-900">{prospect.companyName}</h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
              >
                {meta.label} · {meta.description}
              </span>
              {profileName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  <IconLightbulb className="h-3 w-3" />
                  {profileName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {prospect.industry && prospect.industry !== "미분류" && (
            <DetailField label="산업" value={prospect.industry} icon="🏷" />
          )}
          {prospect.website && (
            <DetailField
              label="웹사이트"
              icon="🌐"
              value={
                <a
                  href={
                    prospect.website.startsWith("http")
                      ? prospect.website
                      : `https://${prospect.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  {prospect.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <IconExternalLink className="h-3 w-3" />
                </a>
              }
            />
          )}
          <DetailField
            label="발굴 시점"
            icon="⏱"
            value={`${formatRelative(prospect.detectedAt)} · ${new Date(
              prospect.detectedAt,
            ).toLocaleString("ko-KR")}`}
          />
          {prospect.notes && (
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">💡 AI 분석</div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {prospect.notes}
              </p>
            </div>
          )}
          {prospect.sourceArticle?.title && (
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">📰 발견 출처</div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm text-slate-800">{prospect.sourceArticle.title}</p>
                {prospect.sourceArticle.uri && (
                  <a
                    href={prospect.sourceArticle.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    원문 보기
                    <IconExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Next steps suggestion */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <div className="text-xs font-semibold text-blue-800">✈ 추천 다음 단계</div>
            <ul className="mt-1.5 space-y-1 text-xs text-blue-900">
              <li>• LinkedIn에서 구매/수입 담당자 검색</li>
              <li>• 회사 공식 채널로 이메일/문의 발송</li>
              <li>• 무역 박람회/매칭 플랫폼에서 접점 확인</li>
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button
            onClick={onDismiss}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <IconX className="h-4 w-4" />
            관심 없음
          </button>
          <button
            onClick={onConvert}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <IconArrowRight className="h-4 w-4" />
            고객으로 전환
          </button>
        </div>
      </div>
    </div>
  )
}

const DetailField: React.FC<{
  label: string
  icon?: string
  value: React.ReactNode
}> = ({ label, icon, value }) => (
  <div>
    <div className="text-xs font-semibold text-slate-500">
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </div>
    <div className="mt-0.5 text-sm text-slate-800">{value}</div>
  </div>
)

const ConfirmDialog: React.FC<{
  state: ConfirmState
  onCancel: () => void
}> = ({ state, onCancel }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
      if (e.key === "Enter") state.onConfirm()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel, state])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">{state.title}</h3>
        {state.description && <p className="mt-1.5 text-sm text-slate-600">{state.description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={state.onConfirm}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white ${
              state.destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const ToastStack: React.FC<{
  toasts: Toast[]
  onDismiss: (id: string) => void
}> = ({ toasts, onDismiss }) => (
  <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2">
    {toasts.map((t) => (
      <div
        key={t.id}
        role="status"
        className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur ${
          t.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : t.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-slate-200 bg-white text-slate-700"
        }`}
      >
        <span className="text-base leading-5">
          {t.tone === "success" ? "✅" : t.tone === "error" ? "⚠️" : "ℹ️"}
        </span>
        <p className="flex-1 leading-relaxed">{t.message}</p>
        <button
          onClick={() => onDismiss(t.id)}
          className="ml-1 rounded p-0.5 text-current opacity-60 hover:bg-black/5 hover:opacity-100"
          aria-label="알림 닫기"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
  </div>
)

const TagsEditor: React.FC<{
  label: string
  helperText?: string
  value: string[]
  input: string
  onChangeInput: (v: string) => void
  onAdd: (v: string) => void
  onAddPreset?: (v: string) => void
  onRemove: (v: string) => void
  presets?: string[]
  tone: "blue" | "indigo" | "violet"
  placeholder?: string
  error?: string
  renderTagPrefix?: (tag: string) => string
}> = ({
  label,
  helperText,
  value,
  input,
  onChangeInput,
  onAdd,
  onAddPreset,
  onRemove,
  presets,
  tone,
  placeholder,
  error,
  renderTagPrefix,
}) => {
  const toneClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {helperText && <p className="mb-1.5 text-xs text-slate-500">{helperText}</p>}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAdd(input)
            }
          }}
          placeholder={placeholder}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
            error ? "border-red-300 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"
          }`}
          aria-invalid={!!error}
        />
        <button
          onClick={() => onAdd(input)}
          type="button"
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          추가
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
            >
              {renderTagPrefix && <span aria-hidden>{renderTagPrefix(tag)}</span>}
              {tag}
              <button
                onClick={() => onRemove(tag)}
                className="hover:opacity-70"
                type="button"
                aria-label={`${tag} 제거`}
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {presets && presets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[11px] text-slate-400">추천:</span>
          {presets
            .filter((p) => {
              const cleaned = p.replace(/^\W+\s*/, "")
              return !value.includes(cleaned)
            })
            .slice(0, 10)
            .map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => (onAddPreset ? onAddPreset(preset) : onAdd(preset))}
                className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                + {preset}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
