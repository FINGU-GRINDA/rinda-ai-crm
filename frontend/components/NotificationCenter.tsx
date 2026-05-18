import type React from "react"
import { useEffect, useState } from "react"
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markNotificationAsRead,
  runNotificationChecks,
} from "../services/notificationService"
import type { Customer, Notification } from "../types"
import {
  IconAlertCircle,
  IconBell,
  IconCalendar,
  IconMail,
  IconNews,
  IconTrendingUp,
  IconX,
} from "./Icons"

interface NotificationCenterProps {
  customers: Customer[]
  onNotificationClick?: (notification: Notification) => void
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  customers,
  onNotificationClick,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  // Load notifications on mount
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Check for new notifications every 5 minutes (independent of customers)
  useEffect(() => {
    const interval = setInterval(
      () => {
        checkNotifications()
      },
      5 * 60 * 1000,
    )

    return () => clearInterval(interval)
  }, [checkNotifications])

  // Reload notifications when customers change
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const loadNotifications = () => {
    const all = getNotifications()
    setNotifications(all)
    setUnreadCount(getUnreadCount())
  }

  const checkNotifications = async () => {
    setIsChecking(true)
    try {
      await runNotificationChecks(customers)
      loadNotifications()
    } catch (error) {
      console.error("Notification check failed:", error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markNotificationAsRead(notification.id)
      loadNotifications()
    }

    if (onNotificationClick) {
      onNotificationClick(notification)
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
    loadNotifications()
  }

  const handleDelete = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteNotification(notificationId)
    loadNotifications()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "email":
        return <IconMail className="w-4 h-4" />
      case "meeting":
        return <IconCalendar className="w-4 h-4" />
      case "followup":
        return <IconTrendingUp className="w-4 h-4" />
      case "news":
        return <IconNews className="w-4 h-4" />
      case "risk":
        return <IconAlertCircle className="w-4 h-4" />
      default:
        return <IconBell className="w-4 h-4" />
    }
  }

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === "high") {
      return "bg-red-50 border-red-200"
    }

    switch (type) {
      case "meeting":
        return "bg-blue-50 border-blue-200"
      case "followup":
        return "bg-amber-50 border-amber-200"
      case "news":
        return "bg-emerald-50 border-emerald-200"
      case "risk":
        return "bg-red-50 border-red-200"
      default:
        return "bg-slate-50 border-slate-200"
    }
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "방금 전"
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    return new Date(timestamp).toLocaleDateString("ko-KR")
  }

  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read).slice(0, 10)

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-600 hover:text-slate-800 touch-target"
        aria-label="알림"
      >
        <IconBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="fixed inset-x-2 top-14 md:inset-auto md:top-16 md:right-4 md:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-[80vh] md:max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBell className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-800">알림</h3>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  모두 읽음
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="px-4 py-2 border-b border-slate-200">
            <button
              onClick={checkNotifications}
              disabled={isChecking}
              className="w-full text-xs text-slate-600 hover:text-slate-800 py-1 disabled:opacity-50"
            >
              {isChecking ? "확인하는 중입니다" : "새 알림 확인"}
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {unreadNotifications.length === 0 && readNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <IconBell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">알림이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Unread Notifications */}
                {unreadNotifications.map((notification) => {
                  const customer = notification.customerId
                    ? customers.find((c) => c.id === notification.customerId)
                    : null

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${
                        notification.priority === "high"
                          ? "border-red-500"
                          : notification.priority === "medium"
                            ? "border-amber-500"
                            : "border-blue-500"
                      } ${getNotificationColor(notification.type, notification.priority)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-blue-600">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-800 truncate">
                              {notification.title}
                            </h4>
                            {notification.priority === "high" && (
                              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                                중요
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mb-1">{notification.message}</p>
                          {customer && <p className="text-xs text-slate-500">{customer.name}</p>}
                          <p className="text-xs text-slate-400 mt-1">
                            {formatTime(new Date(notification.createdAt).getTime())}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(notification.id, e)}
                          className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2"
                        >
                          <IconX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Read Notifications */}
                {readNotifications.length > 0 && unreadNotifications.length > 0 && (
                  <div className="px-4 py-2 bg-slate-50">
                    <p className="text-xs text-slate-500 font-medium">읽은 알림</p>
                  </div>
                )}

                {readNotifications.map((notification) => {
                  const customer = notification.customerId
                    ? customers.find((c) => c.id === notification.customerId)
                    : null

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors opacity-75"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-slate-400">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-600 truncate">
                              {notification.title}
                            </h4>
                          </div>
                          <p className="text-sm text-slate-600 mb-1">{notification.message}</p>
                          {customer && <p className="text-xs text-slate-400">{customer.name}</p>}
                          <p className="text-xs text-slate-400 mt-1">
                            {formatTime(new Date(notification.createdAt).getTime())}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(notification.id, e)}
                          className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2"
                        >
                          <IconX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
