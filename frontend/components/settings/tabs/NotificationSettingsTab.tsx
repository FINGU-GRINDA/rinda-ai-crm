import React, { useState } from 'react';
import { NotificationSettings } from '../../../types';
import { useSettingsToast } from '../SettingsToastContext';
import {
  pageTitle,
  pageDesc,
  card,
  sectionTitle,
  sectionDesc,
  infoNote,
  toggle,
  checkbox,
  divideRows,
} from '../tokens';

const NOTIFICATION_SETTINGS_KEY = 'rinda_notification_settings';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  browser: {
    enabled: true,
    types: {
      followUp: true,
      meeting: true,
      news: true,
      risk: true,
      prospect: true,
    },
  },
  email: {
    enabled: false,
    dailyDigest: false,
    digestTime: '09:00',
  },
};

const getNotificationSettings = (): NotificationSettings => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        browser: { ...DEFAULT_NOTIFICATION_SETTINGS.browser, ...parsed.browser },
        email: { ...DEFAULT_NOTIFICATION_SETTINGS.email, ...parsed.email },
      };
    }
  } catch (error) {
    console.error('Failed to load notification settings:', error);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
};

const saveNotificationSettings = (settings: NotificationSettings): void => {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
};

interface NotificationSettingsTabProps {
  onSettingsChange?: () => void;
}

const BROWSER_TYPES: { key: keyof NotificationSettings['browser']['types']; label: string; desc: string }[] = [
  { key: 'followUp', label: '팔로우업 알림', desc: '예정된 팔로우업 시간이 되면 표시' },
  { key: 'meeting', label: '미팅 알림', desc: '미팅 시작 전 표시' },
  { key: 'prospect', label: '잠재고객 발견', desc: 'AI가 새 잠재고객을 발견했을 때 표시' },
  { key: 'news', label: '고객 뉴스', desc: '담당 고객 관련 뉴스 표시' },
  { key: 'risk', label: '위험 신호', desc: '거래 위험이 감지되면 표시' },
];

export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings());
  const toast = useSettingsToast();

  const persist = (next: NotificationSettings, message = '저장되었습니다') => {
    setSettings(next);
    try {
      saveNotificationSettings(next);
      onSettingsChange?.();
      toast.show('success', message);
    } catch (error) {
      console.error(error);
      toast.show('error', '저장에 실패했습니다');
    }
  };

  const setBrowser = (updates: Partial<NotificationSettings['browser']>) => {
    persist({ ...settings, browser: { ...settings.browser, ...updates } });
  };

  const setBrowserType = (key: keyof NotificationSettings['browser']['types'], value: boolean) => {
    persist({
      ...settings,
      browser: {
        ...settings.browser,
        types: { ...settings.browser.types, [key]: value },
      },
    });
  };

  const setEmail = (updates: Partial<NotificationSettings['email']>) => {
    persist({ ...settings, email: { ...settings.email, ...updates } });
  };

  const handleBrowserToggle = async (enabled: boolean) => {
    if (enabled && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.show('error', '브라우저 권한이 거부되었습니다');
        return;
      }
    }
    setBrowser({ enabled });
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className={pageTitle}>알림</h3>
        <p className={pageDesc}>어디로 알림을 받을지 선택합니다. Slack 알림은 Slack 탭에서 설정합니다.</p>
      </header>

      {/* Browser Notifications */}
      <section>
        <div className="mb-3">
          <h4 className={sectionTitle}>브라우저 알림</h4>
          <p className={sectionDesc}>데스크탑 알림을 표시합니다</p>
        </div>

        <div className={`${card} p-0`}>
          <div className={`flex items-center justify-between gap-4 px-5 py-4`}>
            <div>
              <p className="text-sm font-medium text-slate-900">사용</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {settings.browser.enabled ? '활성화됨' : '비활성화됨'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.browser.enabled}
                onChange={(e) => handleBrowserToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className={toggle} />
            </label>
          </div>

          {settings.browser.enabled && (
            <div className={`${divideRows} border-t border-slate-100`}>
              {BROWSER_TYPES.map((type) => (
                <label
                  key={type.key}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-800">{type.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{type.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.browser.types[type.key]}
                    onChange={(e) => setBrowserType(type.key, e.target.checked)}
                    className={checkbox}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Email Notifications */}
      <section>
        <div className="mb-3">
          <h4 className={sectionTitle}>이메일 알림</h4>
          <p className={sectionDesc}>주요 활동을 이메일로 받습니다</p>
        </div>

        <div className={`${card} p-0`}>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-slate-900">사용</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {settings.email.enabled ? '활성화됨' : '비활성화됨'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email.enabled}
                onChange={(e) => setEmail({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className={toggle} />
            </label>
          </div>

          {settings.email.enabled && (
            <div className="border-t border-slate-100 px-5 py-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">일간 요약</p>
                  <p className="text-xs text-slate-500 mt-0.5">하루 활동을 정해진 시간에 발송</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.dailyDigest}
                  onChange={(e) => setEmail({ dailyDigest: e.target.checked })}
                  className={checkbox}
                />
              </div>

              {settings.email.dailyDigest && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-700">발송 시간</label>
                  <input
                    type="time"
                    value={settings.email.digestTime}
                    onChange={(e) => setEmail({ digestTime: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className={infoNote}>
        Slack 메시지로 알림을 받으려면 <span className="font-medium text-slate-800">Slack</span> 탭에서 Webhook을 연동하세요.
      </div>
    </div>
  );
};
