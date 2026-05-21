/**
 * CRM Backfill Routes
 *
 *   POST /api/v1/crm/backfill/connections  — register a Gmail mailbox connection (slice 1)
 *   GET  /api/v1/crm/backfill/connections  — list workspace connections
 *   POST /api/v1/crm/backfill/start        — enqueue a backfill job
 *   GET  /api/v1/crm/backfill/status       — read progress for a connection
 *
 * Slice 1 uses `provider = "gmail"` exclusively. Unipile flips on in slice 2.
 */

import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../../db"
import { crmBackfillProgress } from "../../db/schema/crm-backfill-progress"
import { crmEmailConnections } from "../../db/schema/crm-email-connections"
import { ROLE_ADMIN, requireRole, workspaceMiddleware } from "../../middleware/workspace"
import { scheduleBackfill } from "../../services/crm/email-backfill.service"
import { ErrorCode, error, success, successList } from "../../utils/response"

// Slice 1: only `gmail` is implemented. `unipile` ships in slice 2 — until
// then it MUST NOT be selectable, or backfill jobs deterministically fail.
const PROVIDERS = ["gmail"] as const

export const crmBackfillRoutes = new Elysia({ prefix: "/api/v1/crm/backfill" })
  .use(workspaceMiddleware)

  // Register a mailbox connection for the workspace. Atomic upsert — the
  // partial unique on (workspace_id, provider, external_account_id) is the
  // single source of truth, so concurrent identical requests collapse to
  // the same row rather than racing past a separate pre-check.
  .post(
    "/connections",
    async ({ workspace, body }) => {
      requireRole(workspace, ROLE_ADMIN)

      const [row] = await db
        .insert(crmEmailConnections)
        .values({
          workspaceId: workspace.workspaceId,
          provider: body.provider,
          externalAccountId: body.externalAccountId,
          displayName: body.displayName ?? null,
        })
        .onConflictDoUpdate({
          target: [
            crmEmailConnections.workspaceId,
            crmEmailConnections.provider,
            crmEmailConnections.externalAccountId,
          ],
          set: { updatedAt: new Date() },
        })
        .returning({ id: crmEmailConnections.id })

      if (!row) {
        return error("Failed to register connection", ErrorCode.INTERNAL_ERROR)
      }
      return success({ id: row.id })
    },
    {
      body: t.Object({
        provider: t.Union(PROVIDERS.map((v) => t.Literal(v))),
        externalAccountId: t.String({ minLength: 1 }),
        displayName: t.Optional(t.String()),
      }),
    },
  )

  // List the workspace's mailbox connections.
  .get("/connections", async ({ workspace }) => {
    const rows = await db
      .select({
        id: crmEmailConnections.id,
        provider: crmEmailConnections.provider,
        externalAccountId: crmEmailConnections.externalAccountId,
        displayName: crmEmailConnections.displayName,
        createdAt: crmEmailConnections.createdAt,
      })
      .from(crmEmailConnections)
      .where(eq(crmEmailConnections.workspaceId, workspace.workspaceId))
    return successList(rows)
  })

  // Start a backfill for a registered connection. Upserts a progress row to
  // `status='running'` and kicks off the in-process runner fire-and-forget.
  // The route returns immediately with the progress row id; the FE polls
  // `GET /status` for completion.
  .post(
    "/start",
    async ({ workspace, body, set }) => {
      requireRole(workspace, ROLE_ADMIN)

      const [connection] = await db
        .select({ id: crmEmailConnections.id })
        .from(crmEmailConnections)
        .where(
          and(
            eq(crmEmailConnections.id, body.emailAccountId),
            eq(crmEmailConnections.workspaceId, workspace.workspaceId),
          ),
        )
        .limit(1)
      if (!connection) {
        set.status = 404
        return error("Email connection not found", ErrorCode.NOT_FOUND)
      }

      // Slice 1: cap monthsBack at 3 to bound Anthropic spend on first runs.
      // The runner also clamps, but stamp the requested value here so it
      // shows correctly in the progress row.
      const monthsBack = body.monthsBack ?? 1

      const [progress] = await db
        .insert(crmBackfillProgress)
        .values({
          workspaceId: workspace.workspaceId,
          emailAccountId: body.emailAccountId,
          status: "running",
          monthsBack,
          startedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [crmBackfillProgress.workspaceId, crmBackfillProgress.emailAccountId],
          set: {
            status: "running",
            monthsBack,
            lastError: null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: crmBackfillProgress.id })

      if (!progress) {
        return error("Failed to register backfill progress", ErrorCode.INTERNAL_ERROR)
      }

      const scheduled = scheduleBackfill(progress.id)
      return success({
        progressId: progress.id,
        status: scheduled ? ("running" as const) : ("already_running" as const),
      })
    },
    {
      body: t.Object({
        emailAccountId: t.String({ format: "uuid" }),
        // Slice 1: cap at 3 to bound Anthropic spend on first runs.
        monthsBack: t.Optional(t.Integer({ minimum: 1, maximum: 3 })),
      }),
    },
  )

  // Read the backfill progress row for a connection.
  .get(
    "/status",
    async ({ workspace, query, set }) => {
      const [row] = await db
        .select()
        .from(crmBackfillProgress)
        .where(
          and(
            eq(crmBackfillProgress.workspaceId, workspace.workspaceId),
            eq(crmBackfillProgress.emailAccountId, query.emailAccountId),
          ),
        )
        .limit(1)
      if (!row) {
        set.status = 404
        return error("No backfill progress for this connection", ErrorCode.NOT_FOUND)
      }
      return success(row)
    },
    {
      query: t.Object({
        emailAccountId: t.String({ format: "uuid" }),
      }),
    },
  )
