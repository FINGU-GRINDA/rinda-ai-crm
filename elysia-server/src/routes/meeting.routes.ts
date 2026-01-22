import { Elysia, t } from "elysia"
import { meetingRepository } from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

export const meetingRoutes = new Elysia({ prefix: "/api/meetings" })
  // Get all meetings with optional filters
  .get(
    "/",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 100
      const offset = query.offset ? parseInt(query.offset, 10) : 0
      const meetings = await meetingRepository.findRecent(limit)
      // Apply offset manually since findRecent doesn't support it
      const slicedMeetings = meetings.slice(offset)
      return successList(slicedMeetings)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Create a new meeting
  .post(
    "/",
    async ({ body }) => {
      const meeting = await meetingRepository.create({
        customerId: body.customerId,
        title: body.title,
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : new Date(),
        summary: body.summary,
        keyDiscussions: body.keyDiscussions ? JSON.stringify(body.keyDiscussions) : undefined,
        actionItems: body.actionItems ? JSON.stringify(body.actionItems) : undefined,
        customerNeeds: body.customerNeeds ? JSON.stringify(body.customerNeeds) : undefined,
        budgetMentions: body.budgetMentions,
        timelineMentions: body.timelineMentions,
        nextSteps: body.nextSteps ? JSON.stringify(body.nextSteps) : undefined,
        transcription: body.transcription,
      })
      return success(meeting)
    },
    {
      body: t.Object({
        customerId: t.String(),
        title: t.String(),
        meetingDate: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        keyDiscussions: t.Optional(t.Array(t.String())),
        actionItems: t.Optional(t.Array(t.String())),
        customerNeeds: t.Optional(t.Array(t.String())),
        budgetMentions: t.Optional(t.String()),
        timelineMentions: t.Optional(t.String()),
        nextSteps: t.Optional(t.Array(t.String())),
        transcription: t.Optional(t.String()),
      }),
    },
  )

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
