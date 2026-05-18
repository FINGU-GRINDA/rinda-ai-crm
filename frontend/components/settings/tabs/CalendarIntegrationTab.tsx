import React, { useState } from 'react';
import { CalendarSettings } from '../../../types';
import { IconCalendar, IconLoader } from '../../Icons';
import { useSettingsToast } from '../SettingsToastContext';
import {
  pageTitle,
  pageDesc,
  card,
  sectionTitle,
  sectionDesc,
  infoNote,
  toggle,
  btnSecondary,
  btnGhost,
  inputBase,
} from '../tokens';

const CALENDAR_SETTINGS_KEY = 'rinda_calendar_settings';

const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  provider: null,
  isConnected: false,
  autoSync: true,
  syncInterval: 300000,
  lastSyncAt: undefined,
  meetingPrepEnabled: true,
};

const getCalendarSettings = (): CalendarSettings => {
  try {
    const stored = localStorage.getItem(CALENDAR_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_CALENDAR_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load calendar settings:', error);
  }
  return DEFAULT_CALENDAR_SETTINGS;
};

const saveCalendarSettings = (settings: CalendarSettings): void => {
  localStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify(settings));
};

const PROVIDER_LABEL: Record<NonNullable<CalendarSettings['provider']>, string> = {
  google: 'Google Calendar',
  outlook: 'Outlook Calendar',
};

const PROVIDER_DESC: Record<NonNullable<CalendarSettings['provider']>, string> = {
  google: 'Google 계정으로 연결',
  outlook: 'Microsoft 계정으로 연결',
};

interface CalendarIntegrationTabProps {
  onSettingsChange?: () => void;
}

export const CalendarIntegrationTab: React.FC<CalendarIntegrationTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<CalendarSettings>(() => getCalendarSettings());
  const [connectingProvider, setConnectingProvider] = useState<CalendarSettings['provider'] | null>(null);
  const toast = useSettingsToast();

  const persist = (next: CalendarSettings, message = '저장되었습니다') => {
    setSettings(next);
    try {
      saveCalendarSettings(next);
      onSettingsChange?.();
      toast.show('success', message);
    } catch (error) {
      console.error(error);
      toast.show('error', '저장에 실패했습니다');
    }
  };

  const handleConnect = async (provider: 'google' | 'outlook') => {
    setConnectingProvider(provider);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    persist(
      {
        ...settings,
        provider,
        isConnected: true,
        lastSyncAt: Date.now(),
      },
      `${PROVIDER_LABEL[provider]}이(가) 연동되었습니다`,
    );
    setConnectingProvider(null);
  };

  const handleDisconnect = () => {
    persist({ ...DEFAULT_CALENDAR_SETTINGS }, '연동이 해제되었습니다');
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className={pageTitle}>캘린더 연동</h3>
        <p className={pageDesc}>
          캘린더를 연동해 미팅 일정을 가져오고, AI가 자동으로 준비 자료를 만들 수 있습니다.
        </p>
      </header>

      {settings.isConnected && settings.provider ? (
        <section className={card}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {PROVIDER_LABEL[settings.provider]} 연동됨
                </p>
                {settings.lastSyncAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    마지막 동기화: {new Date(settings.lastSyncAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={handleDisconnect} className={btnGhost}>
              연동 해제
            </button>
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-3">
            <h4 className={sectionTitle}>제공자 선택</h4>
            <p className={sectionDesc}>연결할 캘린더 서비스를 선택하세요</p>
          </div>

          <div className="space-y-2">
            {(['google', 'outlook'] as const).map((provider) => (
              <button
                key={provider}
                onClick={() => handleConnect(provider)}
                disabled={connectingProvider !== null}
                className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <IconCalendar className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{PROVIDER_LABEL[provider]}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{PROVIDER_DESC[provider]}</p>
                </div>
                {connectingProvider === provider && (
                  <IconLoader className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {settings.isConnected && (
        <section>
          <div className="mb-3">
            <h4 className={sectionTitle}>옵션</h4>
            <p className={sectionDesc}>동기화 및 AI 미팅 준비 동작을 설정합니다</p>
          </div>

          <div className={`${card} space-y-5`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">자동 동기화</p>
                <p className="text-xs text-slate-500 mt-0.5">캘린더 이벤트를 자동으로 가져옵니다</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSync}
                  onChange={(e) => persist({ ...settings, autoSync: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={toggle} />
              </label>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">AI 미팅 준비 자료</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  미팅 전 고객 정보, 최근 활동, 추천 의제를 자동 생성
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.meetingPrepEnabled}
                  onChange={(e) => persist({ ...settings, meetingPrepEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={toggle} />
              </label>
            </div>

            {settings.autoSync && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">동기화 주기</label>
                <select
                  value={settings.syncInterval}
                  onChange={(e) => persist({ ...settings, syncInterval: parseInt(e.target.value, 10) })}
                  className={inputBase}
                >
                  <option value={300000}>5분마다</option>
                  <option value={600000}>10분마다</option>
                  <option value={900000}>15분마다</option>
                  <option value={1800000}>30분마다</option>
                  <option value={3600000}>1시간마다</option>
                </select>
              </div>
            )}

            <div className="pt-1">
              <button type="button" className={btnSecondary}>
                지금 동기화
              </button>
            </div>
          </div>
        </section>
      )}

      <div className={infoNote}>
        OAuth 연결은 시뮬레이션 모드입니다. 실제 연동은 운영 환경에서 OAuth 자격 증명을 구성한 후 사용할 수 있습니다.
      </div>
    </div>
  );
};
