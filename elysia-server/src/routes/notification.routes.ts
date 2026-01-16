import { Elysia, t } from "elysia"
import { notificationRepository } from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

export const notificationRoutes = new Elysia({ prefix: "/api/notifications" })
  // Get all notifications
  .get(
    "/",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const notifications = await notificationRepository.findAll(limit)
      return successList(notifications)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get unread notifications
  .get(
    "/unread",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const notifications = await notificationRepository.findUnread(limit)
      return successList(notifications)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get unread count
  .get("/unread/count", async () => {
    const count = await notificationRepository.getUnreadCount()
    return success({ count })
  })

  // Get notification by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const notification = await notificationRepository.findById(params.id)
      if (!notification) {
        set.status = 404
        return error("Notification not found", ErrorCode.NOTIFICATION_NOT_FOUND)
      }
      return success(notification)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create notification
  .post(
    "/",
    async ({ body, set }) => {
      const notification = await notificationRepository.create(body)
      set.status = 201
      return success(notification)
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("news"),
          t.Literal("followup"),
          t.Literal("lost_deal"),
          t.Literal("prospect"),
          t.Literal("meeting"),
          t.Literal("email"),
          t.Literal("risk"),
          t.Literal("slack"),
        ]),
        title: t.String(),
        message: t.String(),
        customerId: t.Optional(t.String()),
        prospectId: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal("high"), t.Literal("medium"), t.Literal("low")])),
        actionUrl: t.Optional(t.String()),
        metadata: t.Optional(t.String()),
      }),
    },
  )

  // Mark notification as read
  .put(
    "/:id/read",
    async ({ params, set }) => {
      const notification = await notificationRepository.markAsRead(params.id)
      if (!notification) {
        set.status = 404
        return error("Notification not found", ErrorCode.NOTIFICATION_NOT_FOUND)
      }
      return success(notification)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Mark all notifications as read
  .put("/read-all", async () => {
    await notificationRepository.markAllAsRead()
    return success({ markedRead: true })
  })

  // Delete notification
  .delete(
    "/:id",
    async ({ params }) => {
      await notificationRepository.delete(params.id)
      return success({ deleted: true })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Delete old notifications
  .delete(
    "/old",
    async ({ query }) => {
      const days = query.days ? parseInt(query.days, 10) : 30
      const olderThanMs = days * 24 * 60 * 60 * 1000
      await notificationRepository.deleteOld(olderThanMs)
      return success({ deleted: true, olderThanDays: days })
    },
    {
      query: t.Object({
        days: t.Optional(t.String()),
      }),
    },
  )
