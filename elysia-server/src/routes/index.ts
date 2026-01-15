import { Elysia } from "elysia"
import { aiRoutes } from "./ai.routes"
import { calendarRoutes } from "./calendar.routes"
import { contactRoutes } from "./contact.routes"
import { customerRoutes } from "./customer.routes"
import { followUpRoutes } from "./followup.routes"
import { gmailRoutes } from "./gmail.routes"
import { icpRoutes } from "./icp.routes"
import { meetingRoutes } from "./meeting.routes"
import { mixpanelRoutes } from "./mixpanel.routes"
import { notificationRoutes } from "./notification.routes"
import { prospectRoutes } from "./prospect.routes"
import { settingsRoutes } from "./settings.routes"
import { slackApiRoutes } from "./slack-api.routes"
import { slackEventRoutes } from "./slack-event.routes"

export const routes = new Elysia()
  // Core routes
  .use(customerRoutes)
  .use(prospectRoutes)
  .use(contactRoutes)
  .use(meetingRoutes)
  .use(notificationRoutes)
  .use(settingsRoutes)
  .use(icpRoutes)
  .use(followUpRoutes)

  // Integration routes
  .use(aiRoutes)
  .use(slackApiRoutes)
  .use(slackEventRoutes)
  .use(gmailRoutes)
  .use(calendarRoutes)
  .use(mixpanelRoutes)
