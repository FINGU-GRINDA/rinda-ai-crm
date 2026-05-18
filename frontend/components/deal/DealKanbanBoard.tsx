import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiDealCard,
  ApiPipeline,
  ApiPipelineStage,
} from '../../../elysia-server/src/types/api';
import { apiClient } from '../../src/services/apiClient';
import { IconBuilding, IconLoader, IconArrowRight } from '../Icons';

interface DealKanbanBoardProps {
  pipeline: ApiPipeline;
  onSelectDeal?: (deal: ApiDealCard) => void;
  selectedDealId?: string | null;
  // Optional refresh trigger when external mutations happen
  refreshKey?: number;
}

function formatMoney(minor: string, currency: string, locale = 'en-US'): string {
  const decimals = currency === 'JPY' || currency === 'KRW' ? 0 : 2;
  const num = Number(minor) / 10 ** decimals;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return `${num.toFixed(decimals)} ${currency}`;
  }
}

function relativeDays(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function isRotting(deal: ApiDealCard, stage: ApiPipelineStage): boolean {
  if (!stage.rottingDays) return false;
  const ageDays = Math.floor(
    (Date.now() - new Date(deal.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return ageDays >= stage.rottingDays;
}

const stageBadgeColor = (stageType: string): string => {
  switch (stageType) {
    case 'won':
      return 'bg-emerald-100 text-emerald-700';
    case 'lost':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

export const DealKanbanBoard: React.FC<DealKanbanBoardProps> = ({
  pipeline,
  onSelectDeal,
  selectedDealId,
  refreshKey,
}) => {
  const [deals, setDeals] = useState<ApiDealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dropTargetStageId, setDropTargetStageId] = useState<string | null>(null);
  const movingRef = useRef(false);

  const sortedStages = useMemo(
    () => pipeline.stages.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [pipeline.stages],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, ApiDealCard[]>();
    for (const stage of sortedStages) map.set(stage.id, []);
    for (const deal of deals) {
      const arr = map.get(deal.stageId);
      if (arr) arr.push(deal);
    }
    return map;
  }, [deals, sortedStages]);

  const stageTotals = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const stage of sortedStages) totals.set(stage.id, 0n);
    for (const deal of deals) {
      const cur = totals.get(deal.stageId) ?? 0n;
      totals.set(deal.stageId, cur + BigInt(deal.baseAmountMinor));
    }
    return totals;
  }, [deals, sortedStages]);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listDeals({
        pipelineId: pipeline.id,
        includeClosed: false,
        limit: 500,
      });
      if (!response.success) {
        setError(response.error);
        return;
      }
      setDeals(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [pipeline.id]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals, refreshKey]);

  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetStageId(stageId);
  }, []);

  const handleDragLeave = useCallback((stageId: string) => {
    setDropTargetStageId((current) => (current === stageId ? null : current));
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStageId: string) => {
      e.preventDefault();
      setDropTargetStageId(null);
      const dealId = draggedDealId;
      setDraggedDealId(null);
      if (!dealId || movingRef.current) return;

      const targetStage = sortedStages.find((s) => s.id === targetStageId);
      const existing = deals.find((d) => d.id === dealId);
      if (!existing || !targetStage || existing.stageId === targetStageId) return;

      // Optimistic update — replace stage info on the card immediately
      const optimisticDeal: ApiDealCard = {
        ...existing,
        stageId: targetStage.id,
        stage: {
          id: targetStage.id,
          name: targetStage.name,
          color: targetStage.color,
          stageType: targetStage.stageType,
        },
        stageEnteredAt: new Date().toISOString(),
      };
      setDeals((prev) => prev.map((d) => (d.id === dealId ? optimisticDeal : d)));

      movingRef.current = true;
      try {
        const response = await apiClient.moveDealStage(dealId, targetStageId);
        if (!response.success) {
          // Rollback
          setDeals((prev) => prev.map((d) => (d.id === dealId ? existing : d)));
          setError(response.error);
        }
      } catch (err) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? existing : d)));
        setError(err instanceof Error ? err.message : 'Failed to move deal');
      } finally {
        movingRef.current = false;
      }
    },
    [deals, draggedDealId, sortedStages],
  );

  if (loading && deals.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <IconLoader className="w-5 h-5 mr-2 animate-spin" />
        Loading deals…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="mx-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex gap-3 px-4 pb-4 min-w-max">
          {sortedStages.map((stage) => {
            const stageDeals = dealsByStage.get(stage.id) ?? [];
            const totalMinor = stageTotals.get(stage.id) ?? 0n;
            const isDropTarget = dropTargetStageId === stage.id;

            return (
              <div
                key={stage.id}
                className={`flex flex-col bg-slate-50 rounded-lg border w-72 shrink-0 transition-colors ${
                  isDropTarget ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={() => handleDragLeave(stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div
                  className="px-3 py-2 border-b border-slate-200 flex items-center justify-between"
                  style={{ borderLeft: `4px solid ${stage.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">{stage.name}</span>
                    <span
                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${stageBadgeColor(stage.stageType)}`}
                    >
                      {stage.stageType}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{stageDeals.length}</span>
                </div>

                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                  Total: {formatMoney(totalMinor.toString(), stageDeals[0]?.currency ?? 'USD')}
                </div>

                <div className="flex-1 px-2 py-2 space-y-2 min-h-[100px]">
                  {stageDeals.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-4">
                      No deals
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const rotting = isRotting(deal, stage);
                      const isSelected = selectedDealId === deal.id;
                      return (
                        <article
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onClick={() => onSelectDeal?.(deal)}
                          className={`bg-white border rounded-md p-3 cursor-pointer hover:shadow-sm transition-all ${
                            isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
                          } ${draggedDealId === deal.id ? 'opacity-50' : 'opacity-100'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm text-slate-800 truncate">
                                {deal.title}
                              </h3>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {deal.humanId}
                              </div>
                            </div>
                            {rotting && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded"
                                title="This deal has been in this stage too long"
                              >
                                rotting
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-700">
                              {formatMoney(deal.baseAmountMinor, deal.currency)}
                            </div>
                            {deal.probability != null && (
                              <div className="text-xs text-slate-500">{Math.round(Number(deal.probability))}%</div>
                            )}
                          </div>

                          {deal.customer && (
                            <div className="mt-2 flex items-center text-xs text-slate-500 gap-1">
                              <IconBuilding className="w-3.5 h-3.5" />
                              <span className="truncate">{deal.customer.name}</span>
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                            <span title={deal.owner.email}>{deal.owner.name}</span>
                            {relativeDays(deal.stageEnteredAt) && (
                              <span className="flex items-center gap-0.5">
                                <IconArrowRight className="w-3 h-3" />
                                {relativeDays(deal.stageEnteredAt)}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
