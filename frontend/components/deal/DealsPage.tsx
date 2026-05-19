import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ApiPipeline, ApiWorkspaceWithRole } from "../../../elysia-server/src/types/api"
import { apiClient } from "../../src/services/apiClient"
import { getErrorMessage } from "../../src/utils/typeGuards"
import { IconLoader, IconPlus } from "../Icons"
import { WorkspaceBootstrap } from "../workspace/WorkspaceBootstrap"
import { DealFormModal } from "./DealFormModal"
import { DealKanbanBoard } from "./DealKanbanBoard"

type LoadState = "idle" | "loading" | "ready" | "needs-workspace" | "error"

export const DealsPage: React.FC = () => {
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<ApiWorkspaceWithRole[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [pipelines, setPipelines] = useState<ApiPipeline[]>([])
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null)
  const [showDealForm, setShowDealForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === activeWorkspaceId) ??
      workspaces.find((w) => w.isDefault === 1) ??
      workspaces[0] ??
      null,
    [workspaces, activeWorkspaceId],
  )

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) ?? pipelines[0] ?? null,
    [pipelines, activePipelineId],
  )

  const loadWorkspaces = useCallback(async () => {
    const wsResponse = await apiClient.listWorkspaces()
    const wsErr = getErrorMessage(wsResponse)
    if (wsErr !== undefined || !wsResponse.success) {
      throw new Error(wsErr ?? "Failed to load workspaces")
    }
    return wsResponse.data
  }, [])

  const loadPipelines = useCallback(async () => {
    const response = await apiClient.listPipelines()
    const err = getErrorMessage(response)
    if (err !== undefined || !response.success) {
      throw new Error(err ?? "Failed to load pipelines")
    }
    return response.data
  }, [])

  const bootstrap = useCallback(async () => {
    setState("loading")
    setError(null)
    try {
      const wsList = await loadWorkspaces()
      setWorkspaces(wsList)
      if (wsList.length === 0) {
        setState("needs-workspace")
        return
      }
      setActiveWorkspaceId(
        (current) => current ?? wsList.find((w) => w.isDefault === 1)?.id ?? wsList[0]?.id ?? null,
      )

      const pipelineList = await loadPipelines()
      setPipelines(pipelineList)
      setActivePipelineId(
        pipelineList.find((p) => p.isDefault === 1)?.id ?? pipelineList[0]?.id ?? null,
      )
      setState("ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deals page")
      setState("error")
    }
  }, [loadWorkspaces, loadPipelines])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  // Reload pipelines whenever the user switches workspaces. The api client
  // attaches X-Workspace-Id automatically (see apiClient setWorkspaceOverride).
  useEffect(() => {
    if (state !== "ready" || !activeWorkspaceId) return
    apiClient.setWorkspaceOverride(activeWorkspaceId)
    let cancelled = false
    ;(async () => {
      try {
        const pipelineList = await loadPipelines()
        if (cancelled) return
        setPipelines(pipelineList)
        setActivePipelineId(
          pipelineList.find((p) => p.isDefault === 1)?.id ?? pipelineList[0]?.id ?? null,
        )
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to switch workspace")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state, activeWorkspaceId, loadPipelines])

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <IconLoader className="w-5 h-5 mr-2 animate-spin text-blue-600" />
        <span className="text-slate-600 text-sm">Loading deals…</span>
      </div>
    )
  }

  if (state === "needs-workspace") {
    return <WorkspaceBootstrap onCreated={bootstrap} />
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4 p-4">
        <div className="text-red-600 font-medium text-center max-w-md">{error}</div>
        <button
          type="button"
          onClick={bootstrap}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!activePipeline || !activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4 p-4 text-center">
        <div className="text-slate-600">No pipelines available in this workspace.</div>
        <p className="text-xs text-slate-500 max-w-md">
          Pipelines are created automatically when you bootstrap a workspace. If you archived all of
          them, restore one from the database or create a new one via{" "}
          <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">
            POST /api/pipelines
          </code>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Deals</h1>
            <p className="text-xs text-slate-500">
              {activeWorkspace.organizationName} · {activeWorkspace.name} ·{" "}
              <span className="text-slate-400">{activeWorkspace.baseCurrency}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {workspaces.length > 1 && (
              <select
                aria-label="Active workspace"
                value={activeWorkspace.id}
                onChange={(e) => setActiveWorkspaceId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.organizationName} · {w.name}
                  </option>
                ))}
              </select>
            )}
            {pipelines.length > 1 && (
              <select
                aria-label="Active pipeline"
                value={activePipeline.id}
                onChange={(e) => setActivePipelineId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setShowDealForm(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-1.5"
            >
              <IconPlus className="w-4 h-4" />
              New deal
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden py-4">
        <DealKanbanBoard pipeline={activePipeline} refreshKey={refreshKey} />
      </main>

      <DealFormModal
        open={showDealForm}
        pipeline={activePipeline}
        baseCurrency={activeWorkspace.baseCurrency}
        onClose={() => setShowDealForm(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
