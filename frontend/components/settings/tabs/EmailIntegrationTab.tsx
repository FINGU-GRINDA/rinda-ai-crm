import React, { useState, useEffect } from 'react';
import { EmailSettings } from '../../../types';
import { IconCheck, IconMail, IconExternalLink } from '../../Icons';

const EMAIL_SETTINGS_KEY = 'rinda_email_settings';

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: null,
  isConnected: false,
  autoSync: true,
  syncInterval: 300000, // 5분
  lastSyncAt: undefined,
};

const getEmailSettings = (): EmailSettings => {
  try {
    const stored = localStorage.getItem(EMAIL_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_EMAIL_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load email settings:', error);
  }
  return DEFAULT_EMAIL_SETTINGS;
};

const saveEmailSettings = (settings: EmailSettings): void => {
  try {
    localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save email settings:', error);
  }
};

interface EmailIntegrationTabProps {
  onSettingsChange?: () => void;
}

export const EmailIntegrationTab: React.FC<EmailIntegrationTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<EmailSettings>(() => getEmailSettings());
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (provider: 'gmail' | 'outlook') => {
    setIsConnecting(true);

    // 시뮬레이션: 실제로는 OAuth 플로우가 필요
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newSettings: EmailSettings = {
      ...settings,
      provider,
      isConnected: true,
      lastSyncAt: new Date().toISOString(),
    };
    setSettings(newSettings);
    saveEmailSettings(newSettings);
    onSettingsChange?.();
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    const newSettings: EmailSettings = {
      ...DEFAULT_EMAIL_SETTINGS,
    };
    setSettings(newSettings);
    saveEmailSettings(newSettings);
    onSettingsChange?.();
  };

  const handleSettingsChange = (updates: Partial<EmailSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveEmailSettings(newSettings);
  };

  const formatInterval = (ms: number): string => {
    const minutes = ms / 60000;
    if (minutes < 60) return `${minutes}분`;
    return `${minutes / 60}시간`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">이메일 연동</h3>
        <p className="text-sm text-slate-500">이메일을 연동하여 고객과의 커뮤니케이션을 추적합니다.</p>
      </div>

      {/* Connection Status */}
      {settings.isConnected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <IconCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="text-sm font-semibold text-emerald-900">
                  {settings.provider === 'gmail' ? 'Gmail' : 'Outlook'} 연동됨
                </span>
                {settings.lastSyncAt && (
                  <p className="text-xs text-emerald-700">
                    마지막 동기화: {new Date(settings.lastSyncAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline"
            >
              연동 해제
            </button>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      {!settings.isConnected && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">이메일 서비스 선택</p>

          <button
            onClick={() => handleConnect('gmail')}
            disabled={isConnecting}
            className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <IconMail className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-slate-900">Gmail</span>
              <p className="text-xs text-slate-500">Google 계정으로 연결</p>
            </div>
            {isConnecting && <span className="text-xs text-slate-500">연결 중...</span>}
          </button>

          <button
            onClick={() => handleConnect('outlook')}
            disabled={isConnecting}
            className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <IconMail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-slate-900">Outlook</span>
              <p className="text-xs text-slate-500">Microsoft 계정으로 연결</p>
            </div>
            {isConnecting && <span className="text-xs text-slate-500">연결 중...</span>}
          </button>
        </div>
      )}

      {/* Sync Settings */}
      {settings.isConnected && (
        <div className="border-t border-slate-200 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-700">자동 동기화</label>
              <p className="text-xs text-slate-500">새 이메일을 자동으로 가져옵니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => handleSettingsChange({ autoSync: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {settings.autoSync && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">동기화 주기</label>
              <select
                value={settings.syncInterval}
                onChange={(e) => handleSettingsChange({ syncInterval: parseInt(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value={300000}>5분마다</option>
                <option value={600000}>10분마다</option>
                <option value={900000}>15분마다</option>
                <option value={1800000}>30분마다</option>
                <option value={3600000}>1시간마다</option>
              </select>
            </div>
          )}

          <button className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">
            지금 동기화
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 mb-1">알림</p>
            <p className="text-xs text-amber-700">
              현재 이메일 연동은 시뮬레이션 모드입니다. 실제 연동을 위해서는 OAuth 설정이 필요합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
