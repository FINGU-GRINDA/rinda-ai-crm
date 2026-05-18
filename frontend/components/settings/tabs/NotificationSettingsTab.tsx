import React, { useState, useEffect } from 'react';
import { NotificationSettings } from '../../../types';
import { IconBell } from '../../Icons';

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
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save notification settings:', error);
  }
};

interface NotificationSettingsTabProps {
  onSettingsChange?: () => void;
}

export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings());

  const handleBrowserSettingsChange = (updates: Partial<NotificationSettings['browser']>) => {
    const newSettings: NotificationSettings = {
      ...settings,
      browser: { ...settings.browser, ...updates },
    };
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const handleBrowserTypeChange = (type: keyof NotificationSettings['browser']['types'], value: boolean) => {
    const newSettings: NotificationSettings = {
      ...settings,
      browser: {
        ...settings.browser,
        types: { ...settings.browser.types, [type]: value },
      },
    };
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const handleEmailSettingsChange = (updates: Partial<NotificationSettings['email']>) => {
    const newSettings: NotificationSettings = {
      ...settings,
      email: { ...settings.email, ...updates },
    };
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        handleBrowserSettingsChange({ enabled: true });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">알림 설정</h3>
        <p className="text-sm text-slate-500">CRM 알림을 어떻게 받을지 설정합니다.</p>
      </div>

      {/* Browser Notifications */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <IconBell className="w-5 h-5 text-slate-600" />
          <h4 className="text-base font-semibold text-slate-800">브라우저 알림</h4>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-700">브라우저 알림 활성화</label>
              <p className="text-xs text-slate-500">데스크탑 알림을 표시합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.browser.enabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    requestBrowserPermission();
                  } else {
                    handleBrowserSettingsChange({ enabled: false });
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {settings.browser.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700">알림 유형</p>

              <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-slate-700">팔로우업 알림</span>
                  <p className="text-xs text-slate-500">예정된 팔로우업 시간 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.browser.types.followUp}
                  onChange={(e) => handleBrowserTypeChange('followUp', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-slate-700">미팅 알림</span>
                  <p className="text-xs text-slate-500">예정된 미팅 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.browser.types.meeting}
                  onChange={(e) => handleBrowserTypeChange('meeting', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-slate-700">뉴스 알림</span>
                  <p className="text-xs text-slate-500">고객 관련 뉴스 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.browser.types.news}
                  onChange={(e) => handleBrowserTypeChange('news', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-slate-700">잠재고객 발견</span>
                  <p className="text-xs text-slate-500">새 잠재고객 발견 시 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.browser.types.prospect}
                  onChange={(e) => handleBrowserTypeChange('prospect', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-slate-700">위험 경고</span>
                  <p className="text-xs text-slate-500">거래 위험 감지 시 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.browser.types.risk}
                  onChange={(e) => handleBrowserTypeChange('risk', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <IconBell className="w-5 h-5 text-slate-600" />
          <h4 className="text-base font-semibold text-slate-800">이메일 알림</h4>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-700">이메일 알림 활성화</label>
              <p className="text-xs text-slate-500">중요 알림을 이메일로 받습니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email.enabled}
                onChange={(e) => handleEmailSettingsChange({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {settings.email.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-slate-700">일간 요약</label>
                  <p className="text-xs text-slate-500">하루 활동을 요약하여 매일 발송</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.dailyDigest}
                  onChange={(e) => handleEmailSettingsChange({ dailyDigest: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>

              {settings.email.dailyDigest && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">발송 시간</label>
                  <input
                    type="time"
                    value={settings.email.digestTime}
                    onChange={(e) => handleEmailSettingsChange({ digestTime: e.target.value })}
                    className="border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">Slack 알림</p>
            <p className="text-xs text-blue-700">
              Slack으로 알림을 받으시려면 'Slack 연동' 탭에서 설정해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
