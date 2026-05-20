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
import { addCrmEmailBackfillJob } from "../../lib/queue/queues"
import { ROLE_ADMIN, requireRole, workspaceMiddleware } from "../../middleware/workspace"
import { ErrorCode, error, success, successList } from "../../utils/response"

const PROVIDERS = ["gmail", "unipile"] as const

export const crmBackfillRoutes = new Elysia({ prefix: "/api/v1/crm/backfill" })
  .use(workspaceMiddleware)

  // Register a mailbox connection for the workspace.
  .post(
    "/connections",
    async ({ workspace, body }) => {
      requireRole(workspace, ROLE_ADMIN)

      const [existing] = await db
        .select({ id: crmEmailConnections.id })
        .from(crmEmailConnections)
        .where(
          and(
            eq(crmEmailConnections.workspaceId, workspace.workspaceId),
            eq(crmEmailConnections.provider, body.provider),
            eq(crmEmailConnections.externalAccountId, body.externalAccountId),
          ),
        )
        .limit(1)
      if (existing) {
        return success({ id: existing.id })
      }

      const [created] = await db
        .insert(crmEmailConnections)
        .values({
          workspaceId: workspace.workspaceId,
          provider: body.provider,
          externalAccountId: body.externalAccountId,
          displayName: body.displayName ?? null,
        })
        .returning({ id: crmEmailConnections.id })

      if (!created) {
        return error("Failed to register connection", ErrorCode.INTERNAL_ERROR)
      }
      return success({ id: created.id })
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

  // Enqueue a backfill for a registered connection.
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

      const jobId = await addCrmEmailBackfillJob({
        workspaceId: workspace.workspaceId,
        emailAccountId: body.emailAccountId,
        monthsBack: body.monthsBack ?? 1,
      })
      return success({ jobId, status: "enqueued" as const })
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
