import type React from "react"
import { useState } from "react"
import { apiClient } from "../../src/services/apiClient"
import { getErrorMessage } from "../../src/utils/typeGuards"
import { IconLoader } from "../Icons"

interface WorkspaceBootstrapProps {
  onCreated: () => void
}

type PipelineTemplate = "b2b-saas" | "agency" | "ecommerce"

const TEMPLATE_OPTIONS: Array<{ value: PipelineTemplate; label: string; description: string }> = [
  {
    value: "b2b-saas",
    label: "B2B SaaS Sales",
    description: "Lead → Qualified → Demo → Proposal → Negotiation → Won/Lost",
  },
  {
    value: "agency",
    label: "Agency",
    description: "Inquiry → Discovery → Proposal Sent → Contract → Won/Lost",
  },
  {
    value: "ecommerce",
    label: "E-commerce / Wholesale",
    description: "New → Sample Sent → Negotiation → PO Received → Won/Lost",
  },
]

const CURRENCY_OPTIONS = ["USD", "KRW", "JPY", "EUR", "GBP"]
const LOCALE_OPTIONS = ["en-US", "ko-KR", "ja-JP"]

export const WorkspaceBootstrap: React.FC<WorkspaceBootstrapProps> = ({ onCreated }) => {
  const [organizationName, setOrganizationName] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [baseCurrency, setBaseCurrency] = useState("USD")
  const [locale, setLocale] = useState("en-US")
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  )
  const [pipelineTemplate, setPipelineTemplate] = useState<PipelineTemplate>("b2b-saas")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationName.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.createWorkspace({
        organizationName: organizationName.trim(),
        workspaceName: workspaceName.trim() || undefined,
        baseCurrency,
        locale,
        timezone,
        pipelineTemplate,
      })
      const errMsg = getErrorMessage(response)
      if (errMsg !== undefined) {
        setError(errMsg)
        return
      }
      // Pin subsequent requests to the brand-new workspace immediately so the
      // user doesn't accidentally get an empty default workspace if they had one.
      if (response.success && response.data.workspace?.id) {
        apiClient.setWorkspaceOverride(response.data.workspace.id)
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white shadow-xl rounded-xl p-6 sm:p-8 space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create your workspace</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bootstraps your organization and seeds a starter pipeline so you can start tracking
            deals immediately.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="org-name">
            Organization name
          </label>
          <input
            id="org-name"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="Acme Inc."
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="ws-name">
            Workspace name <span className="text-slate-400">(defaults to organization)</span>
          </label>
          <input
            id="ws-name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Sales"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="ws-currency">
              Base currency
            </label>
            <select
              id="ws-currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="ws-locale">
              Locale
            </label>
            <select
              id="ws-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              {LOCALE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="ws-tz">
              Timezone
            </label>
            <input
              id="ws-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Starter pipeline</label>
          <div className="grid grid-cols-1 gap-2">
            {TEMPLATE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  pipelineTemplate === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="pipelineTemplate"
                  value={opt.value}
                  checked={pipelineTemplate === opt.value}
                  onChange={() => setPipelineTemplate(opt.value)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm text-slate-800">{opt.label}</div>
                  <div className="text-xs text-slate-500">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !organizationName.trim()}
          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <IconLoader className="w-4 h-4 animate-spin" />}
          Create workspace
        </button>
      </form>
    </div>
  )
}
