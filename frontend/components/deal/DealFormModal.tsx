import type React from "react"
import { useEffect, useId, useMemo, useState } from "react"
import type { ApiPipeline } from "../../../elysia-server/src/types/api"
import { apiClient } from "../../src/services/apiClient"
import { getErrorMessage } from "../../src/utils/typeGuards"
import { IconLoader, IconX } from "../Icons"

interface DealFormModalProps {
  open: boolean
  pipeline: ApiPipeline
  baseCurrency: string
  onClose: () => void
  onCreated: () => void
}

const FORECAST_OPTIONS = [
  { value: "pipeline", label: "Pipeline" },
  { value: "best_case", label: "Best case" },
  { value: "commit", label: "Commit" },
  { value: "omitted", label: "Omitted" },
] as const

type ForecastOption = (typeof FORECAST_OPTIONS)[number]["value"]

export const DealFormModal: React.FC<DealFormModalProps> = ({
  open,
  pipeline,
  baseCurrency,
  onClose,
  onCreated,
}) => {
  const titleId = useId()
  const amountId = useId()
  const stageId = useId()
  const currencyId = useId()
  const closeDateId = useId()
  const probId = useId()
  const fcId = useId()

  const sortedStages = useMemo(
    () => pipeline.stages.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [pipeline.stages],
  )
  const firstOpenStageId = useMemo(
    () => sortedStages.find((s) => s.stageType === "open")?.id ?? sortedStages[0]?.id ?? "",
    [sortedStages],
  )

  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState(baseCurrency)
  const [selectedStage, setSelectedStage] = useState<string>(firstOpenStageId)
  const [forecastCategory, setForecastCategory] = useState<ForecastOption>("pipeline")
  const [expectedCloseDate, setExpectedCloseDate] = useState("")
  const [probability, setProbability] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle("")
      setAmount("")
      setCurrency(baseCurrency)
      setSelectedStage(firstOpenStageId)
      setForecastCategory("pipeline")
      setExpectedCloseDate("")
      setProbability("")
      setError(null)
    }
  }, [open, baseCurrency, firstOpenStageId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedStage) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.createDeal({
        pipelineId: pipeline.id,
        stageId: selectedStage,
        title: title.trim(),
        amount: amount.trim() || undefined,
        currency: currency || undefined,
        forecastCategory,
        expectedCloseDate: expectedCloseDate || undefined,
        probability: probability.trim() || undefined,
      })
      const errMsg = getErrorMessage(response)
      if (errMsg !== undefined) {
        setError(errMsg)
        return
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deal")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 space-y-4"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between">
          <h2 id={titleId} className="text-lg font-bold text-slate-800">
            New deal
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor={`${titleId}-input`}>
            Title
          </label>
          <input
            id={`${titleId}-input`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Acme — Q1 renewal"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-medium text-slate-600" htmlFor={amountId}>
              Amount
            </label>
            <input
              id={amountId}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor={currencyId}>
              Currency
            </label>
            <input
              id={currencyId}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              minLength={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono uppercase"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor={stageId}>
              Stage
            </label>
            <select
              id={stageId}
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              {sortedStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.stageType})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor={fcId}>
              Forecast
            </label>
            <select
              id={fcId}
              value={forecastCategory}
              onChange={(e) => setForecastCategory(e.target.value as ForecastOption)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              {FORECAST_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor={closeDateId}>
              Expected close date
            </label>
            <input
              id={closeDateId}
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor={probId}>
              Probability (%)
            </label>
            <input
              id={probId}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              inputMode="decimal"
              placeholder="(stage default)"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !selectedStage}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <IconLoader className="w-4 h-4 animate-spin" />}
            Create deal
          </button>
        </div>
      </form>
    </div>
  )
}
