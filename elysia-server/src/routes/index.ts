import { Elysia } from "elysia"
import { authMiddleware } from "../middleware/auth"
import { aiRoutes } from "./ai.routes"
import { authRoutes } from "./auth.routes"
import { calendarRoutes } from "./calendar.routes"
import { contactRoutes } from "./contact.routes"
import { customerRoutes } from "./customer.routes"
import { followUpRoutes } from "./followup.routes"
import { gmailRoutes } from "./gmail.routes"
import { icpRoutes } from "./icp.routes"
import { leadsRoutes } from "./leads.routes"
import { meetingRoutes } from "./meeting.routes"
import { mixpanelRoutes } from "./mixpanel.routes"
import { notificationRoutes } from "./notification.routes"
import { prospectRoutes } from "./prospect.routes"
import { settingsRoutes } from "./settings.routes"
import { slackApiRoutes } from "./slack-api.routes"
import { slackEventRoutes } from "./slack-event.routes"

// Protected routes with auth middleware (proactive token refresh)
const protectedRoutes = new Elysia()
  .use(authMiddleware)
  // Core routes
  .use(customerRoutes)
  .use(prospectRoutes)
  .use(leadsRoutes) // Alias for prospects (frontend compatibility)
  .use(contactRoutes)
  .use(meetingRoutes)
  .use(notificationRoutes)
  .use(settingsRoutes)
  .use(icpRoutes)
  .use(followUpRoutes)
  // Integration routes (user-facing)
  .use(aiRoutes)
  .use(slackApiRoutes)
  .use(gmailRoutes)
  .use(calendarRoutes)
  .use(mixpanelRoutes)

export const routes = new Elysia()
  // Public routes (no auth required)
  .use(authRoutes) // Has its own public/protected routes
  .use(slackEventRoutes) // Webhook from Slack (uses HMAC verification)

  // Protected routes (with proactive token refresh)
  .use(protectedRoutes)
