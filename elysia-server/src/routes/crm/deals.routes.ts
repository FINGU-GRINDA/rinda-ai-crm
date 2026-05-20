/**
 * CRM Deals Routes
 *
 *   GET   /api/v1/crm/deals       — list (keyset pagination + active/lost filter)
 *   GET   /api/v1/crm/deals/:id   — detail (accounts + persons + last 50 messages)
 *   PATCH /api/v1/crm/deals/:id   — update stage and/or lost flag (admin)
 *   GET   /api/v1/crm/messages    — messages for a deal (walks contacts)
 *
 * Adapted from send-grid-test routes/crm/crm-deals.routes.ts — replaces the
 * source's authMacro + adminOrTabAllowlist with this repo's workspaceMiddleware
 * + requireRole pattern.
 */

import { Elysia, t } from "elysia"
import { ROLE_ADMIN, requireRole, workspaceMiddleware } from "../../middleware/workspace"
import {
  getDealDetail,
  listBackfillRuns,
  listDealMessages,
  listDeals,
  updateDeal as updateDealService,
} from "../../services/crm/deals.service"
import { BadRequestError } from "../../utils/errors"
import { success, successList } from "../../utils/response"

const DEAL_STAGES = ["engaged", "in_conversation", "negotiating", "confirmed", "contract"] as const

export const crmDealsRoutes = new Elysia({ prefix: "/api/v1/crm" })
  .use(workspaceMiddleware)

  .get(
    "/deals",
    async ({ workspace, query }) => {
      if (query.includeLost && query.onlyLost) {
        throw new BadRequestError("includeLost and onlyLost are mutually exclusive", {
          code: "LOST_FLAGS_CONFLICT",
        })
      }
      const lostFilter: "active" | "all" | "only" = query.onlyLost
        ? "only"
        : query.includeLost
          ? "all"
          : "active"
      const result = await listDeals({
        workspaceId: workspace.workspaceId,
        dealStage: query.dealStage,
        isBackfilled: query.isBackfilled,
        lostFilter,
        cursor: query.cursor ?? null,
        limit: query.limit,
      })
      return success(result)
    },
    {
      query: t.Object({
        dealStage: t.Optional(t.Union(DEAL_STAGES.map((v) => t.Literal(v)))),
        isBackfilled: t.Optional(t.Boolean()),
        includeLost: t.Optional(t.Boolean()),
        onlyLost: t.Optional(t.Boolean()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })),
      }),
    },
  )

  .get(
    "/deals/:id",
    async ({ workspace, params }) => {
      const deal = await getDealDetail({
        workspaceId: workspace.workspaceId,
        dealId: params.id,
      })
      return success({ deal })
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) },
  )

  .patch(
    "/deals/:id",
    async ({ workspace, auth, params, body }) => {
      requireRole(workspace, ROLE_ADMIN)
      const updated = await updateDealService({
        workspaceId: workspace.workspaceId,
        dealId: params.id,
        userId: auth.userId,
        dealStage: body.dealStage,
        // `lostAt` key presence signals intent. Server stamps NOW() on non-null.
        lostAtPatch: "lostAt" in body ? { value: body.lostAt ?? null } : null,
      })
      return success(updated)
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({
        dealStage: t.Optional(t.Union(DEAL_STAGES.map((v) => t.Literal(v)))),
        lostAt: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )

  .get(
    "/messages",
    async ({ workspace, query }) => {
      const result = await listDealMessages({
        workspaceId: workspace.workspaceId,
        dealId: query.dealId,
        cursor: query.cursor ?? null,
        limit: query.limit,
      })
      return success(result)
    },
    {
      query: t.Object({
        dealId: t.String({ format: "uuid" }),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })),
      }),
    },
  )

  .get("/backfill/runs", async ({ workspace }) => {
    requireRole(workspace, ROLE_ADMIN)
    const runs = await listBackfillRuns({ workspaceId: workspace.workspaceId })
    return successList(runs)
  })
