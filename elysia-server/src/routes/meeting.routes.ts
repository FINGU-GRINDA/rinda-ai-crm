import { Elysia, t } from "elysia"
import { meetingRepository } from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

export const meetingRoutes = new Elysia({ prefix: "/api/meetings" })
  // Get recent meetings
  .get(
    "/recent",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const meetings = await meetingRepository.findRecent(limit)
      return successList(meetings)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get meetings by date range
  .get(
    "/range",
    async ({ query }) => {
      const startDate = new Date(parseInt(query.startDate, 10))
      const endDate = new Date(parseInt(query.endDate, 10))
      const meetings = await meetingRepository.findByDateRange(startDate, endDate)
      return successList(meetings)
    },
    {
      query: t.Object({
        startDate: t.String(),
        endDate: t.String(),
      }),
    },
  )

  // Get meeting by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const meeting = await meetingRepository.findById(params.id)
      if (!meeting) {
        set.status = 404
        return error("Meeting not found", ErrorCode.MEETING_NOT_FOUND)
      }
      return success(meeting)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Update meeting
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const meeting = await meetingRepository.update(params.id, body)
      if (!meeting) {
        set.status = 404
        return error("Meeting not found", ErrorCode.MEETING_NOT_FOUND)
      }
      return success(meeting)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        meetingDate: t.Optional(t.Date()),
        audioFileUrl: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        summary: t.Optional(t.String()),
        keyDiscussions: t.Optional(t.String()),
        actionItems: t.Optional(t.String()),
        customerNeeds: t.Optional(t.String()),
        budgetMentions: t.Optional(t.String()),
        timelineMentions: t.Optional(t.String()),
        nextSteps: t.Optional(t.String()),
        transcription: t.Optional(t.String()),
      }),
    },
  )

  // Delete meeting
  .delete(
    "/:id",
    async ({ params }) => {
      await meetingRepository.delete(params.id)
      return success({ deleted: true })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Update meeting summary (AI processed)
  .put(
    "/:id/summary",
    async ({ params, body, set }) => {
      const meeting = await meetingRepository.updateSummary(params.id, body)
      if (!meeting) {
        set.status = 404
        return error("Meeting not found", ErrorCode.MEETING_NOT_FOUND)
      }
      return success(meeting)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        summary: t.Optional(t.String()),
        keyDiscussions: t.Optional(t.String()),
        actionItems: t.Optional(t.String()),
        customerNeeds: t.Optional(t.String()),
        budgetMentions: t.Optional(t.String()),
        timelineMentions: t.Optional(t.String()),
        nextSteps: t.Optional(t.String()),
      }),
    },
  )
