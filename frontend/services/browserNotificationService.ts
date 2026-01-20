/**
 * Browser Web Push Notification Service
 * 브라우저 푸시 알림 서비스 - Web Notification API 사용
 */

import { Notification as CRMNotification } from '../types';

// Notification permission status
type NotificationPermission = 'default' | 'granted' | 'denied';

// Storage keys
const NOTIFICATION_SETTINGS_KEY = 'rinda_browser_notification_settings';

// Settings interface
interface BrowserNotificationSettings {
  enabled: boolean;
  followUpReminders: boolean;
  meetingAlerts: boolean;
  lostDealReminders: boolean;
  prospectAlerts: boolean;
  riskAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string;
  soundEnabled: boolean;
}

// Default settings
const DEFAULT_SETTINGS: BrowserNotificationSettings = {
  enabled: true,
  followUpReminders: true,
  meetingAlerts: true,
  lostDealReminders: true,
  prospectAlerts: true,
  riskAlerts: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  soundEnabled: true
};

/**
 * Check if browser supports notifications
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission as NotificationPermission;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    console.warn('Browser notifications are not supported');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
};

/**
 * Get notification settings from localStorage
 */
export const getNotificationSettings = (): BrowserNotificationSettings => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load notification settings:', error);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Save notification settings to localStorage
 */
export const saveNotificationSettings = (settings: Partial<BrowserNotificationSettings>): void => {
  try {
    const current = getNotificationSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save notification settings:', error);
  }
};

/**
 * Check if notifications are within quiet hours
 */
export const isQuietHours = (): boolean => {
  const settings = getNotificationSettings();
  if (!settings.quietHoursEnabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

/**
 * Check if notification type is enabled
 */
export const isNotificationTypeEnabled = (type: CRMNotification['type']): boolean => {
  const settings = getNotificationSettings();

  if (!settings.enabled) return false;

  switch (type) {
    case 'followup':
      return settings.followUpReminders;
    case 'meeting':
      return settings.meetingAlerts;
    case 'lost_deal':
      return settings.lostDealReminders;
    case 'prospect':
      return settings.prospectAlerts;
    case 'risk':
      return settings.riskAlerts;
    case 'news':
      return true; // News always enabled if main toggle is on
    default:
      return true;
  }
};

/**
 * Get notification icon based on type
 */
const getNotificationIcon = (type: CRMNotification['type']): string => {
  // Default icon - could be replaced with actual icons
  const icons: Record<string, string> = {
    followup: '/icons/followup.png',
    meeting: '/icons/meeting.png',
    lost_deal: '/icons/lost.png',
    prospect: '/icons/prospect.png',
    risk: '/icons/risk.png',
    news: '/icons/news.png'
  };
  return icons[type] || '/icons/default.png';
};

/**
 * Play notification sound
 */
const playNotificationSound = (): void => {
  const settings = getNotificationSettings();
  if (!settings.soundEnabled) return;

  try {
    // Use Web Audio API for notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
};

/**
 * Show browser notification
 */
export const showBrowserNotification = async (
  notification: CRMNotification,
  onClick?: () => void
): Promise<boolean> => {
  // Check if notifications are supported and permitted
  if (!isNotificationSupported()) {
    console.warn('Browser notifications not supported');
    return false;
  }

  if (getNotificationPermission() !== 'granted') {
    console.warn('Browser notification permission not granted');
    return false;
  }

  // Check if in quiet hours
  if (isQuietHours()) {
    console.log('Notification suppressed: quiet hours');
    return false;
  }

  // Check if notification type is enabled
  if (!isNotificationTypeEnabled(notification.type)) {
    console.log(`Notification type "${notification.type}" is disabled`);
    return false;
  }

  try {
    // Create and show notification
    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: getNotificationIcon(notification.type),
      tag: notification.id, // Prevents duplicate notifications
      requireInteraction: notification.priority === 'high',
      silent: !getNotificationSettings().soundEnabled
    });

    // Play custom sound if enabled
    playNotificationSound();

    // Handle click
    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
      if (onClick) onClick();
    };

    // Auto-close after 10 seconds for low/medium priority
    if (notification.priority !== 'high') {
      setTimeout(() => browserNotification.close(), 10000);
    }

    return true;
  } catch (error) {
    console.error('Failed to show browser notification:', error);
    return false;
  }
};

/**
 * Show follow-up reminder notification
 */
export const showFollowUpReminderNotification = async (
  customerName: string,
  followUpType: string,
  onNavigate?: () => void
): Promise<void> => {
  const notification: CRMNotification = {
    id: `browser_followup_${Date.now()}`,
    type: 'followup',
    title: 'Follow-up 알림',
    message: `${customerName}에게 ${followUpType} Follow-up 시간입니다.`,
    priority: 'high',
    read: false,
    createdAt: new Date().toISOString()
  };

  await showBrowserNotification(notification, onNavigate);
};

/**
 * Show meeting reminder notification
 */
export const showMeetingReminderNotification = async (
  customerName: string,
  meetingTitle: string,
  minutesUntil: number,
  onNavigate?: () => void
): Promise<void> => {
  const timeText = minutesUntil <= 60
    ? `${minutesUntil}분 후`
    : `${Math.floor(minutesUntil / 60)}시간 후`;

  const notification: CRMNotification = {
    id: `browser_meeting_${Date.now()}`,
    type: 'meeting',
    title: '미팅 알림',
    message: `${customerName}와의 "${meetingTitle}" 미팅이 ${timeText}에 시작됩니다.`,
    priority: minutesUntil <= 30 ? 'high' : 'medium',
    read: false,
    createdAt: new Date().toISOString()
  };

  await showBrowserNotification(notification, onNavigate);
};

/**
 * Show risk alert notification
 */
export const showRiskAlertNotification = async (
  customerName: string,
  riskReason: string,
  onNavigate?: () => void
): Promise<void> => {
  const notification: CRMNotification = {
    id: `browser_risk_${Date.now()}`,
    type: 'risk',
    title: '위험 신호 감지',
    message: `${customerName}: ${riskReason}`,
    priority: 'high',
    read: false,
    createdAt: new Date().toISOString()
  };

  await showBrowserNotification(notification, onNavigate);
};

/**
 * Show prospect signal notification
 */
export const showProspectSignalNotification = async (
  prospectName: string,
  signalChange: string,
  onNavigate?: () => void
): Promise<void> => {
  const notification: CRMNotification = {
    id: `browser_prospect_${Date.now()}`,
    type: 'prospect',
    title: 'Prospect 신호',
    message: `${prospectName}: ${signalChange}`,
    priority: 'medium',
    read: false,
    createdAt: new Date().toISOString()
  };

  await showBrowserNotification(notification, onNavigate);
};

/**
 * Show customer news notification
 */
export const showCustomerNewsNotification = async (
  customerName: string,
  newsTitle: string,
  onNavigate?: () => void
): Promise<void> => {
  const notification: CRMNotification = {
    id: `browser_news_${Date.now()}`,
    type: 'news',
    title: '고객사 뉴스',
    message: `${customerName}: ${newsTitle}`,
    priority: 'low',
    read: false,
    createdAt: new Date().toISOString()
  };

  await showBrowserNotification(notification, onNavigate);
};

/**
 * Initialize browser notifications
 * Should be called on app start
 */
export const initializeBrowserNotifications = async (): Promise<void> => {
  if (!isNotificationSupported()) {
    console.log('Browser notifications not supported');
    return;
  }

  // Request permission if not already granted or denied
  const currentPermission = getNotificationPermission();
  if (currentPermission === 'default') {
    await requestNotificationPermission();
  }
};

export default {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  showBrowserNotification,
  showFollowUpReminderNotification,
  showMeetingReminderNotification,
  showRiskAlertNotification,
  showProspectSignalNotification,
  showCustomerNewsNotification,
  initializeBrowserNotifications
};
