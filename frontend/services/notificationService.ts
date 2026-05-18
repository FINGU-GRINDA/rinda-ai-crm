import type { CalendarEvent, Customer, Notification, ScheduledFollowUp } from "../types"
import { getDueFollowUps, getOverdueFollowUps, getUpcomingFollowUps } from "./autoFollowUpService"
import {
  initializeBrowserNotifications,
  showBrowserNotification,
  showFollowUpReminderNotification,
  showMeetingReminderNotification,
} from "./browserNotificationService"
import { getUpcomingMeetings } from "./calendarIntegrationService"
import {
  sendDailyDigestNotification,
  sendFollowUpCompletedNotification,
  sendFollowUpReminder,
  shouldSendDailyDigest,
} from "./slackIntegrationService"

// Notifications Storage
const NOTIFICATIONS_KEY = "rinda_notifications"

// Get all notifications
export const getNotifications = (): Notification[] => {
  const stored = localStorage.getItem(NOTIFICATIONS_KEY)
  return stored ? JSON.parse(stored) : []
}

// Save notification
export const saveNotification = (notification: Notification): void => {
  const existing = getNotifications()

  // Avoid duplicates (same type, customer, and similar time)
  const isDuplicate = existing.some(
    (n) =>
      n.type === notification.type &&
      n.customerId === notification.customerId &&
      Math.abs(new Date(n.createdAt).getTime() - new Date(notification.createdAt).getTime()) <
        60000, // Within 1 minute
  )

  if (!isDuplicate) {
    existing.unshift(notification)
    // Keep last 1000 notifications
    const trimmed = existing.slice(0, 1000)
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed))
  }
}

// Mark notification as read
export const markNotificationAsRead = (notificationId: string): void => {
  const existing = getNotifications()
  const notification = existing.find((n) => n.id === notificationId)
  if (notification) {
    notification.read = true
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing))
  }
}

// Mark all notifications as read
export const markAllAsRead = (): void => {
  const existing = getNotifications()
  existing.forEach((n) => {
    n.read = true
  })
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing))
}

// Delete notification
export const deleteNotification = (notificationId: string): void => {
  const existing = getNotifications()
  const filtered = existing.filter((n) => n.id !== notificationId)
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered))
}

// Get unread notifications count
export const getUnreadCount = (): number => {
  return getNotifications().filter((n) => !n.read).length
}

// Get notifications by priority
export const getNotificationsByPriority = (priority: "high" | "medium" | "low"): Notification[] => {
  return getNotifications().filter((n) => n.priority === priority && !n.read)
}

// Create notification for follow-up due
export const createFollowUpDueNotification = (
  followUp: ScheduledFollowUp,
  customer: Customer,
): Notification => {
  return {
    id: `notif_followup_${followUp.id}`,
    type: "followup",
    title: "Follow-up 시기입니다",
    message: `${customer.name}에 대한 ${followUp.type === "email" ? "이메일" : followUp.type === "call" ? "전화" : followUp.type === "meeting" ? "미팅" : "메시지"} Follow-up이 예정되어 있습니다.`,
    customerId: customer.id,
    priority: followUp.priority,
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: `/customer/${customer.id}`,
    metadata: {
      followUpId: followUp.id,
      type: followUp.type,
    },
  }
}

// Create notification for upcoming meeting
export const createMeetingNotification = (
  event: CalendarEvent,
  customer: Customer,
): Notification => {
  const hoursUntil = Math.floor(
    (new Date(event.startTime).getTime() - Date.now()) / (1000 * 60 * 60),
  )

  return {
    id: `notif_meeting_${event.id}`,
    type: "meeting",
    title: hoursUntil <= 24 ? "내일 미팅 예정" : "다가오는 미팅",
    message: `${customer.name}와의 미팅이 ${hoursUntil <= 24 ? "내일" : `${Math.floor(hoursUntil / 24)}일 후`} 예정되어 있습니다: ${event.title}`,
    customerId: customer.id,
    priority: hoursUntil <= 24 ? "high" : "medium",
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: `/customer/${customer.id}`,
    metadata: {
      eventId: event.id,
      startTime: event.startTime,
    },
  }
}

// Create notification for customer news/change
export const createNewsNotification = (
  customer: Customer,
  newsTitle: string,
  newsUrl?: string,
): Notification => {
  return {
    id: `notif_news_${Date.now()}_${customer.id}`,
    type: "news",
    title: "고객사 뉴스",
    message: `${customer.name}: ${newsTitle}`,
    customerId: customer.id,
    priority: "medium",
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: `/customer/${customer.id}`,
    metadata: {
      newsUrl,
      newsTitle,
    },
  }
}

// Create notification for lost deal re-engagement
export const createLostDealNotification = (
  customer: Customer,
  daysSinceLost: number,
): Notification => {
  return {
    id: `notif_lost_${customer.id}`,
    type: "lost_deal",
    title: "Lost Deal 재접촉 시기",
    message: `${customer.name}와의 거래 실패 후 ${daysSinceLost}일이 지났습니다. 재접촉을 고려해보세요.`,
    customerId: customer.id,
    priority: daysSinceLost >= 30 ? "high" : "medium",
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: `/customer/${customer.id}`,
    metadata: {
      daysSinceLost,
      lostReason: customer.lostReason,
    },
  }
}

// Create notification for prospect signal change
export const createProspectNotification = (
  prospectName: string,
  signalStrength: "high" | "medium" | "low",
  change: "increased" | "decreased",
): Notification => {
  return {
    id: `notif_prospect_${Date.now()}`,
    type: "prospect",
    title: "Prospect 신호 변화",
    message: `${prospectName}의 신호 강도가 ${change === "increased" ? "상승" : "하락"}했습니다 (${signalStrength === "high" ? "높음" : signalStrength === "medium" ? "중간" : "낮음"})`,
    priority: signalStrength === "high" ? "high" : "medium",
    read: false,
    createdAt: new Date().toISOString(),
    metadata: {
      prospectName,
      signalStrength,
      change,
    },
  }
}

// Create notification for risk detection
export const createRiskNotification = (customer: Customer, riskReason: string): Notification => {
  return {
    id: `notif_risk_${Date.now()}_${customer.id}`,
    type: "risk",
    title: "위험 신호 감지",
    message: `${customer.name}: ${riskReason}`,
    customerId: customer.id,
    priority: "high",
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: `/customer/${customer.id}`,
    metadata: {
      riskReason,
    },
  }
}

// Check and create notifications for due follow-ups
export const checkFollowUpNotifications = (customers: Customer[]): Notification[] => {
  const dueFollowUps = getDueFollowUps()
  const notifications: Notification[] = []

  for (const followUp of dueFollowUps) {
    const customer = customers.find((c) => c.id === followUp.customerId)
    if (customer) {
      const notification = createFollowUpDueNotification(followUp, customer)
      saveNotification(notification)
      notifications.push(notification)

      // Send browser notification
      const followUpTypeText =
        followUp.type === "email"
          ? "이메일"
          : followUp.type === "call"
            ? "전화"
            : followUp.type === "meeting"
              ? "미팅"
              : "메시지"
      showFollowUpReminderNotification(customer.name, followUpTypeText).catch((err) => {
        console.error("Failed to send browser notification:", err)
      })

      // Send Slack notification
      sendFollowUpReminder(customer, followUp).catch((err) => {
        console.error("Failed to send Slack follow-up reminder:", err)
      })
    }
  }

  return notifications
}

// Check and create notifications for upcoming meetings
export const checkMeetingNotifications = async (customers: Customer[]): Promise<Notification[]> => {
  const notifications: Notification[] = []

  for (const customer of customers) {
    try {
      const meetings = await getUpcomingMeetings(customer.id, 7)

      for (const meeting of meetings) {
        const hoursUntil = (new Date(meeting.startTime).getTime() - Date.now()) / (1000 * 60 * 60)
        const minutesUntil = Math.floor(
          (new Date(meeting.startTime).getTime() - Date.now()) / (1000 * 60),
        )

        // Notify if meeting is within 24 hours or exactly 1 day before
        if (hoursUntil <= 24 && hoursUntil > 0) {
          const notification = createMeetingNotification(meeting, customer)

          // Check if already notified for this meeting
          const existing = getNotifications().find(
            (n) => n.type === "meeting" && n.metadata?.eventId === meeting.id,
          )

          if (!existing) {
            saveNotification(notification)
            notifications.push(notification)

            // Send browser notification for meetings within 2 hours
            if (hoursUntil <= 2) {
              showMeetingReminderNotification(customer.name, meeting.title, minutesUntil).catch(
                (err) => {
                  console.error("Failed to send browser meeting notification:", err)
                },
              )
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to check meetings for ${customer.name}:`, error)
    }
  }

  return notifications
}

// Check and create notifications for lost deals
export const checkLostDealNotifications = (customers: Customer[]): Notification[] => {
  const notifications: Notification[] = []
  const now = Date.now()

  for (const customer of customers) {
    if (customer.status === "lost" && customer.lostAt) {
      const daysSinceLost = Math.floor(
        (now - new Date(customer.lostAt).getTime()) / (1000 * 60 * 60 * 24),
      )

      // Notify at 30, 60, 90 days
      if (daysSinceLost === 30 || daysSinceLost === 60 || daysSinceLost === 90) {
        const notification = createLostDealNotification(customer, daysSinceLost)

        // Check if already notified for this milestone
        const existing = getNotifications().find(
          (n) =>
            n.type === "lost_deal" &&
            n.customerId === customer.id &&
            n.metadata?.daysSinceLost === daysSinceLost,
        )

        if (!existing) {
          saveNotification(notification)
          notifications.push(notification)
        }
      }
    }
  }

  return notifications
}

// Run all notification checks
export const runNotificationChecks = async (customers: Customer[]): Promise<Notification[]> => {
  const allNotifications: Notification[] = []

  // Initialize browser notifications if not already done
  await initializeBrowserNotifications().catch((err) => {
    console.warn("Failed to initialize browser notifications:", err)
  })

  // Check follow-ups
  const followUpNotifs = checkFollowUpNotifications(customers)
  allNotifications.push(...followUpNotifs)

  // Check meetings
  const meetingNotifs = await checkMeetingNotifications(customers)
  allNotifications.push(...meetingNotifs)

  // Check lost deals
  const lostDealNotifs = checkLostDealNotifications(customers)
  allNotifications.push(...lostDealNotifs)

  // Show browser notifications for high priority items
  for (const notification of allNotifications) {
    if (notification.priority === "high") {
      showBrowserNotification(notification).catch((err) => {
        console.warn("Failed to show browser notification:", err)
      })
    }
  }

  // Check if daily digest should be sent
  await checkAndSendDailyDigest(customers)

  return allNotifications
}

// Create notification for follow-up completed
export const createFollowUpCompletedNotification = (
  followUp: ScheduledFollowUp,
  customer: Customer,
  completionNote?: string,
): Notification => {
  return {
    id: `notif_completed_${followUp.id}`,
    type: "followup",
    title: "Follow-up 완료",
    message: `${customer.name}에 대한 ${followUp.type === "email" ? "이메일" : followUp.type === "call" ? "전화" : followUp.type === "meeting" ? "미팅" : "메시지"} Follow-up이 완료되었습니다.${completionNote ? ` - ${completionNote}` : ""}`,
    customerId: customer.id,
    priority: "low",
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: `/customer/${customer.id}`,
    metadata: {
      followUpId: followUp.id,
      type: followUp.type,
      completionNote,
    },
  }
}

// Handle follow-up completion with notifications
export const notifyFollowUpCompleted = async (
  followUp: ScheduledFollowUp,
  customer: Customer,
  completionNote?: string,
): Promise<void> => {
  // Create and save local notification
  const notification = createFollowUpCompletedNotification(followUp, customer, completionNote)
  saveNotification(notification)

  // Send Slack notification
  await sendFollowUpCompletedNotification(customer, followUp, completionNote).catch((err) => {
    console.error("Failed to send Slack follow-up completed notification:", err)
  })
}

// Check and send daily digest if conditions are met
export const checkAndSendDailyDigest = async (customers: Customer[]): Promise<void> => {
  if (!shouldSendDailyDigest()) {
    return
  }

  const overdueFollowUps = getOverdueFollowUps()
  const upcomingToday = getUpcomingFollowUps(1) // Get today's follow-ups

  // Build today's follow-up list with customer info
  const todayFollowUps = upcomingToday
    .filter((f) => {
      const scheduledDate = new Date(f.scheduledFor)
      const today = new Date()
      return (
        scheduledDate.getDate() === today.getDate() &&
        scheduledDate.getMonth() === today.getMonth() &&
        scheduledDate.getFullYear() === today.getFullYear()
      )
    })
    .map((followUp) => {
      const customer = customers.find((c) => c.id === followUp.customerId)
      return { customer: customer!, followUp }
    })
    .filter((item) => item.customer)

  const pendingCount = getUpcomingFollowUps(7).length

  await sendDailyDigestNotification(pendingCount, overdueFollowUps.length, todayFollowUps).catch(
    (err) => {
      console.error("Failed to send daily digest:", err)
    },
  )
}
