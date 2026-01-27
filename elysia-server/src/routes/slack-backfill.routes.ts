import { Elysia, t } from "elysia"
import { slackBackfillService } from "../services/slack-backfill.service"
import { ErrorCode, error, success } from "../utils/response"

export const slackBackfillRoutes = new Elysia({ prefix: "/api/slack/backfill" })
  // POST /api/slack/backfill - Start a backfill
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await slackBackfillService.backfill({
          channelType: body.channelType,
          channelId: body.channelId,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          limit: body.limit,
          dryRun: body.dryRun,
          batchSize: body.batchSize,
          delayBetweenBatches: body.delayBetweenBatches,
          delayBetweenMessages: body.delayBetweenMessages,
        })

        return success(result)
      } catch (err) {
        set.status = 500
        const errorMsg = err instanceof Error ? err.message : String(err)
        return error(errorMsg, ErrorCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        channelType: t.Optional(
          t.Union([t.Literal("cs"), t.Literal("sales"), t.Literal("meeting-notes")]),
        ),
        channelId: t.Optional(t.String()),
        startDate: t.String(), // ISO date string
        endDate: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
        dryRun: t.Optional(t.Boolean()),
        batchSize: t.Optional(t.Number()),
        delayBetweenBatches: t.Optional(t.Number()),
        delayBetweenMessages: t.Optional(t.Number()),
      }),
    },
  )

  // GET /api/slack/backfill/preview - Preview what would be backfilled (dry run)
  .get(
    "/preview",
    async ({ query, set }) => {
      try {
        const result = await slackBackfillService.backfill({
          channelType: query.channelType as "cs" | "sales" | "meeting-notes" | undefined,
          channelId: query.channelId,
          startDate: new Date(query.startDate),
          endDate: query.endDate ? new Date(query.endDate) : undefined,
          limit: query.limit ? parseInt(query.limit, 10) : 50,
          dryRun: true,
        })

        return success(result)
      } catch (err) {
        set.status = 500
        const errorMsg = err instanceof Error ? err.message : String(err)
        return error(errorMsg, ErrorCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        channelType: t.Optional(t.String()),
        channelId: t.Optional(t.String()),
        startDate: t.String(),
        endDate: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
