import { Elysia } from "elysia"
import { authMiddleware } from "../middleware/auth"
import { aiRoutes } from "./ai.routes"
import { authRoutes } from "./auth.routes"
import { calendarRoutes } from "./calendar.routes"
import { contactRoutes } from "./contact.routes"
import { crmBackfillRoutes } from "./crm/backfill.routes"
import { customerRoutes } from "./customer.routes"
import { dealRoutes } from "./deal.routes"
import { followUpRoutes } from "./followup.routes"
import { gmailRoutes } from "./gmail.routes"
import { icpRoutes } from "./icp.routes"
import { leadsRoutes } from "./leads.routes"
import { meetingRoutes } from "./meeting.routes"
import { notificationRoutes } from "./notification.routes"
import { pipelineRoutes } from "./pipeline.routes"
import { prospectRoutes } from "./prospect.routes"
import { settingsRoutes } from "./settings.routes"
import { slackApiRoutes } from "./slack-api.routes"
import { slackBackfillRoutes } from "./slack-backfill.routes"
import { slackEventRoutes } from "./slack-event.routes"
import { workspaceRoutes } from "./workspace.routes"

export const routes = new Elysia()
  // Auth routes (public)
  .use(authRoutes)

  // Workspace routes — list/create endpoints are auth-only, /current uses workspace ctx internally.
  .use(workspaceRoutes)

  // Auth middleware - protects all routes below
  .use(authMiddleware)

  // Core routes (auth required)
  .use(customerRoutes)
  .use(prospectRoutes)
  .use(leadsRoutes)
  .use(contactRoutes)
  .use(meetingRoutes)
  .use(notificationRoutes)
  .use(settingsRoutes)
  .use(icpRoutes)
  .use(followUpRoutes)

  // Phase 0/1 — deal pipeline (uses workspace middleware internally)
  .use(pipelineRoutes)
  .use(dealRoutes)

  // CRM rebuild — slice 1 (uses workspace middleware internally)
  .use(crmBackfillRoutes)

  // Integration routes
  .use(aiRoutes)
  .use(slackApiRoutes)
  .use(slackBackfillRoutes)
  .use(slackEventRoutes)
  .use(gmailRoutes)
  .use(calendarRoutes)
