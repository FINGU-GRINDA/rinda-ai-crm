/**
 * Deal Materializer — turns a Stage Classifier output into DB rows.
 *
 * Lifted verbatim from send-grid-test/elysia-server/src/services/crm/deal-materializer.service.ts.
 *
 * Three paths in a single transaction:
 *
 * 1. ROUTER SKIP. The classifier's championPerson already has a Deal in this
 *    workspace (any role on `crm_deal_persons`, any stage, manual or auto).
 *    Rule: auto-create at most one Deal per buyer Person. Returns the existing
 *    Deal id, optionally advancing its stage (never demoting).
 *
 * 2. INSERT path. INSERT INTO crm_deals (is_backfilled=true) ON CONFLICT DO
 *    NOTHING. On success: write crm_deal_accounts / crm_deal_persons / a
 *    crm_object_events deal_created row / extraction rollup onto crm_messages.
 *
 * 3. THREAD-RECLASSIFY path. The router lookup missed but the same
 *    threadExternalId already has a Deal. Update `deal_stage` iff
 *    `is_backfilled = true` AND the stage hasn't been manually overridden.
 */

import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "../../db"
import {
  type DealStage,
  dealAccounts,
  dealPersons,
  dealStageEnum,
  deals,
  messages,
} from "../../db/schema/crm-deals"
import { crmObjectEvents } from "../../db/schema/crm-events"
import logger from "../../utils/logger"
import type { ClassificationResult } from "./stage-classifier.service"

const STAGE_ORDER: readonly DealStage[] = dealStageEnum.enumValues
const stageIdx = (s: DealStage): number => STAGE_ORDER.indexOf(s)

export interface MaterializeDealParams {
  workspaceId: string
  threadExternalId: string
  classification: ClassificationResult
}

export interface MaterializeDealResult {
  dealId: string
  created: boolean
}

export async function materializeDealFromClassification(
  params: MaterializeDealParams,
): Promise<MaterializeDealResult> {
  const { workspaceId, threadExternalId, classification } = params

  const accountId = classification.accountId
  if (!accountId) {
    throw new Error(
      `materializeDealFromClassification: classification has no accountId (thread=${threadExternalId})`,
    )
  }

  const dealStage: DealStage = classification.assignedStage

  return db.transaction(async (tx) => {
    // Router check — auto-create at most one Deal per buyer Person.
    if (classification.championPersonId) {
      const [routerExisting] = await tx
        .select({
          id: deals.id,
          dealStage: deals.dealStage,
          isBackfilled: deals.isBackfilled,
          fieldOverrides: deals.fieldOverrides,
          threadExternalId: deals.threadExternalId,
        })
        .from(deals)
        .innerJoin(
          dealPersons,
          and(
            eq(dealPersons.dealId, deals.id),
            eq(dealPersons.personId, classification.championPersonId),
          ),
        )
        .where(eq(deals.workspaceId, workspaceId))
        .limit(1)

      if (routerExisting) {
        // Advance stage if higher (never demote), respecting manual overrides.
        const stageOverridden =
          (routerExisting.fieldOverrides as Record<string, unknown> | null)?.deal_stage != null
        const stageAdvances = stageIdx(dealStage) > stageIdx(routerExisting.dealStage)
        if (routerExisting.isBackfilled && !stageOverridden && stageAdvances) {
          const updated = await tx
            .update(deals)
            .set({ dealStage, updatedAt: new Date() })
            .where(
              and(
                eq(deals.id, routerExisting.id),
                eq(deals.isBackfilled, true),
                sql`NOT (${deals.fieldOverrides} ? 'deal_stage')`,
              ),
            )
            .returning({ id: deals.id })

          if (updated.length === 0) {
            // Lost the race — rep manually set stage between SELECT and UPDATE.
            return { dealId: routerExisting.id, created: false }
          }

          await tx.insert(crmObjectEvents).values({
            workspaceId,
            eventType: "deal_stage_changed",
            targetType: "deal",
            targetId: routerExisting.id,
            sourceType: "classifier",
            classifierConfidence: classification.confidenceScore.toFixed(2),
            metadata: {
              from: routerExisting.dealStage,
              to: dealStage,
              threadExternalId,
              detectedSignals: classification.detectedSignals,
              rationaleText: classification.rationaleText,
              modelVersion: "claude-sonnet-4-6",
              trigger:
                routerExisting.threadExternalId === threadExternalId
                  ? "reclassify"
                  : "router-attach",
            },
          })
        }

        return { dealId: routerExisting.id, created: false }
      }
    }

    // Idempotent INSERT.
    const inserted = await tx
      .insert(deals)
      .values({
        workspaceId,
        threadExternalId,
        dealStage,
        isBackfilled: true,
      })
      .onConflictDoNothing({
        target: [deals.workspaceId, deals.threadExternalId],
        where: sql`${deals.threadExternalId} IS NOT NULL`,
      })
      .returning({ id: deals.id })

    if (inserted.length === 0) {
      // Conflict path — re-classify existing thread or untouchable manual Deal.
      const [existing] = await tx
        .select({
          id: deals.id,
          dealStage: deals.dealStage,
          isBackfilled: deals.isBackfilled,
          fieldOverrides: deals.fieldOverrides,
        })
        .from(deals)
        .where(
          and(eq(deals.workspaceId, workspaceId), eq(deals.threadExternalId, threadExternalId)),
        )
        .limit(1)
      if (!existing) {
        throw new Error(
          `materializeDealFromClassification: insert conflict but row not found on re-read (thread=${threadExternalId})`,
        )
      }

      const stageOverridden =
        (existing.fieldOverrides as Record<string, unknown> | null)?.deal_stage != null
      const stageChanged = existing.dealStage !== dealStage
      if (existing.isBackfilled && !stageOverridden && stageChanged) {
        const updated = await tx
          .update(deals)
          .set({ dealStage, updatedAt: new Date() })
          .where(
            and(
              eq(deals.id, existing.id),
              eq(deals.isBackfilled, true),
              sql`NOT (${deals.fieldOverrides} ? 'deal_stage')`,
            ),
          )
          .returning({ id: deals.id })

        if (updated.length === 0) {
          return { dealId: existing.id, created: false }
        }

        await tx.insert(crmObjectEvents).values({
          workspaceId,
          eventType: "deal_stage_changed",
          targetType: "deal",
          targetId: existing.id,
          sourceType: "classifier",
          classifierConfidence: classification.confidenceScore.toFixed(2),
          metadata: {
            from: existing.dealStage,
            to: dealStage,
            threadExternalId,
            detectedSignals: classification.detectedSignals,
            rationaleText: classification.rationaleText,
            modelVersion: "claude-sonnet-4-6",
            trigger: "reclassify",
          },
        })
      }

      return { dealId: existing.id, created: false }
    }

    const dealId = inserted[0]?.id
    if (!dealId) {
      throw new Error(
        `materializeDealFromClassification: insert returned no row (thread=${threadExternalId})`,
      )
    }

    // Primary buyer Account.
    await tx.insert(dealAccounts).values({
      workspaceId,
      dealId,
      accountId,
      role: "buyer",
      isPrimary: true,
    })

    // Primary champion Person (when resolved).
    if (classification.championPersonId) {
      await tx.insert(dealPersons).values({
        workspaceId,
        dealId,
        personId: classification.championPersonId,
        role: "champion",
        isPrimary: true,
      })
    }

    // Thread-level extraction rollup.
    if (Object.keys(classification.extractionJson).length > 0) {
      await tx
        .update(messages)
        .set({
          extractionJson: sql`${messages.extractionJson} || ${classification.extractionJson}::jsonb`,
        })
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            eq(messages.threadExternalId, threadExternalId),
          ),
        )
    }

    // Provenance event.
    await tx.insert(crmObjectEvents).values({
      workspaceId,
      eventType: "deal_created",
      targetType: "deal",
      targetId: dealId,
      sourceType: "classifier",
      classifierConfidence: classification.confidenceScore.toFixed(2),
      metadata: {
        threadExternalId,
        assignedStage: dealStage,
        detectedSignals: classification.detectedSignals,
        rationaleText: classification.rationaleText,
        modelVersion: "claude-sonnet-4-6",
      },
    })

    return { dealId, created: true }
  })
}

export interface CleanupRejectedDealResult {
  deleted: boolean
  dealId: string | null
  skipReason?: "manual_override" | "lost" | "not_backfilled"
}

/**
 * Delete a backfilled Deal whose thread was rejected by a (post-creation)
 * classifier gate. Refuses to delete when:
 *   - `field_overrides.deal_stage` set → rep manually moved the card
 *   - `lost_at` set → rep already archived as lost (preserve audit trail)
 *   - `is_backfilled = false` → manual deal
 *
 * Cascade FKs handle deal_persons / deal_accounts. The crm_object_events row
 * is intentionally retained (events have no hard FK to deals).
 *
 * Idempotent.
 */
export async function cleanupRejectedDeal(params: {
  workspaceId: string
  threadExternalId: string
  rejectionReason: string
}): Promise<CleanupRejectedDealResult> {
  const { workspaceId, threadExternalId, rejectionReason } = params

  const [existing] = await db
    .select({
      id: deals.id,
      isBackfilled: deals.isBackfilled,
      lostAt: deals.lostAt,
      fieldOverrides: deals.fieldOverrides,
    })
    .from(deals)
    .where(and(eq(deals.workspaceId, workspaceId), eq(deals.threadExternalId, threadExternalId)))
    .limit(1)

  if (!existing) return { deleted: false, dealId: null }

  if (!existing.isBackfilled) {
    return { deleted: false, dealId: existing.id, skipReason: "not_backfilled" }
  }
  if (existing.lostAt) {
    return { deleted: false, dealId: existing.id, skipReason: "lost" }
  }
  if (
    existing.fieldOverrides &&
    typeof existing.fieldOverrides === "object" &&
    "deal_stage" in existing.fieldOverrides
  ) {
    return { deleted: false, dealId: existing.id, skipReason: "manual_override" }
  }

  const deleted = await db
    .delete(deals)
    .where(
      and(
        eq(deals.id, existing.id),
        eq(deals.isBackfilled, true),
        isNull(deals.lostAt),
        sql`NOT (${deals.fieldOverrides} ? 'deal_stage')`,
      ),
    )
    .returning({ id: deals.id })

  if (deleted.length === 0) {
    logger.info(
      { workspaceId, threadExternalId, dealId: existing.id, rejectionReason },
      "[deal-materializer] cleanupRejectedDeal: row mutated mid-flight, leaving alone",
    )
    return { deleted: false, dealId: existing.id, skipReason: "manual_override" }
  }

  logger.info(
    { workspaceId, threadExternalId, dealId: existing.id, rejectionReason },
    "[deal-materializer] cleanupRejectedDeal: deleted backfilled deal rejected by gate",
  )
  return { deleted: true, dealId: existing.id }
}
