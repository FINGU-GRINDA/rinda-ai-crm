import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiPipeline, ApiWorkspaceWithRole } from '../../../elysia-server/src/types/api';
import { apiClient } from '../../src/services/apiClient';
import { IconLoader } from '../Icons';
import { DealKanbanBoard } from './DealKanbanBoard';
import { WorkspaceBootstrap } from '../workspace/WorkspaceBootstrap';

type LoadState = 'idle' | 'loading' | 'ready' | 'needs-workspace' | 'error';

export const DealsPage: React.FC = () => {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<ApiWorkspaceWithRole[]>([]);
  const [pipelines, setPipelines] = useState<ApiPipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) ?? pipelines[0] ?? null,
    [pipelines, activePipelineId],
  );

  const bootstrap = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const wsResponse = await apiClient.listWorkspaces();
      if (!wsResponse.success) {
        setError(wsResponse.error);
        setState('error');
        return;
      }
      setWorkspaces(wsResponse.data);

      if (wsResponse.data.length === 0) {
        setState('needs-workspace');
        return;
      }

      const pipelinesResponse = await apiClient.listPipelines();
      if (!pipelinesResponse.success) {
        setError(pipelinesResponse.error);
        setState('error');
        return;
      }
      setPipelines(pipelinesResponse.data);
      setActivePipelineId(
        pipelinesResponse.data.find((p) => p.isDefault === 1)?.id ??
          pipelinesResponse.data[0]?.id ??
          null,
      );
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals page');
      setState('error');
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <IconLoader className="w-5 h-5 mr-2 animate-spin text-blue-600" />
        <span className="text-slate-600 text-sm">Loading deals…</span>
      </div>
    );
  }

  if (state === 'needs-workspace') {
    return <WorkspaceBootstrap onCreated={bootstrap} />;
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
        <div className="text-red-600 font-medium">{error}</div>
        <button
          type="button"
          onClick={bootstrap}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!activePipeline) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-600">
        No pipelines available in this workspace.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Deals</h1>
            {workspaces[0] && (
              <p className="text-xs text-slate-500">
                {workspaces[0].organizationName} · {workspaces[0].name}
              </p>
            )}
          </div>
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
        </div>
      </header>

      <main className="flex-1 overflow-hidden py-4">
        <DealKanbanBoard pipeline={activePipeline} />
      </main>
    </div>
  );
};
