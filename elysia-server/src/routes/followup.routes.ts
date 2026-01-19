import { Elysia, t } from "elysia"
import { customerRepository, followUpRepository } from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

export const followUpRoutes = new Elysia({ prefix: "/api/followups" })
  // Get pending scheduled follow-ups
  .get("/pending", async () => {
    const followups = await followUpRepository.findPendingScheduled()
    return successList(followups)
  })

  // Get due follow-ups
  .get("/due", async () => {
    const followups = await followUpRepository.findDueScheduled()
    return successList(followups)
  })

  // Get follow-ups by date range
  .get(
    "/range",
    async ({ query }) => {
      const startDate = new Date(parseInt(query.startDate, 10))
      const endDate = new Date(parseInt(query.endDate, 10))
      const followups = await followUpRepository.findScheduledByDateRange(startDate, endDate)
      return successList(followups)
    },
    {
      query: t.Object({
        startDate: t.String(),
        endDate: t.String(),
      }),
    },
  )

  // Create follow-up history entry
  .post(
    "/history",
    async ({ body, set }) => {
      const history = await followUpRepository.createHistory(body)

      // Update customer's last follow-up time
      await customerRepository.updateFollowUp(body.customerId)

      set.status = 201
      return success(history)
    },
    {
      body: t.Object({
        customerId: t.String(),
        type: t.Union([
          t.Literal("email"),
          t.Literal("call"),
          t.Literal("meeting"),
          t.Literal("message"),
        ]),
        content: t.Optional(t.String()),
        status: t.Optional(
          t.Union([t.Literal("planned"), t.Literal("completed"), t.Literal("cancelled")]),
        ),
      }),
    },
  )

  // Update follow-up history status
  .put(
    "/history/:id/status",
    async ({ params, body, set }) => {
      const history = await followUpRepository.updateHistoryStatus(params.id, body.status)
      if (!history) {
        set.status = 404
        return error("Follow-up history not found", ErrorCode.FOLLOWUP_NOT_FOUND)
      }
      return success(history)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([t.Literal("planned"), t.Literal("completed"), t.Literal("cancelled")]),
      }),
    },
  )

  // Create scheduled follow-up
  .post(
    "/scheduled",
    async ({ body, set }) => {
      const scheduled = await followUpRepository.createScheduled({
        ...body,
        scheduledFor: new Date(body.scheduledFor),
      })
      set.status = 201
      return success(scheduled)
    },
    {
      body: t.Object({
        customerId: t.String(),
        scheduledFor: t.Number(),
        type: t.Union([
          t.Literal("email"),
          t.Literal("call"),
          t.Literal("meeting"),
          t.Literal("message"),
        ]),
        content: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal("high"), t.Literal("medium"), t.Literal("low")])),
        reason: t.Optional(t.String()),
      }),
    },
  )

  // Complete scheduled follow-up
  .put(
    "/scheduled/:id/complete",
    async ({ params, set }) => {
      const scheduled = await followUpRepository.completeScheduled(params.id)
      if (!scheduled) {
        set.status = 404
        return error("Scheduled follow-up not found", ErrorCode.FOLLOWUP_NOT_FOUND)
      }
      return success(scheduled)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Cancel scheduled follow-up
  .put(
    "/scheduled/:id/cancel",
    async ({ params, set }) => {
      const scheduled = await followUpRepository.cancelScheduled(params.id)
      if (!scheduled) {
        set.status = 404
        return error("Scheduled follow-up not found", ErrorCode.FOLLOWUP_NOT_FOUND)
      }
      return success(scheduled)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Delete scheduled follow-up
  .delete(
    "/scheduled/:id",
    async ({ params }) => {
      await followUpRepository.deleteScheduled(params.id)
      return success({ deleted: true })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
