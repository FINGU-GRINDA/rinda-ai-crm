import React from 'react';
import { SettingsTabType } from '../../types';
import { IconBrain, IconSparkles, IconMail, IconCalendar, IconBell } from '../Icons';

// Slack 아이콘 (lucide-react에 없으므로 직접 정의)
const IconSlack: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="13" y="2" width="3" height="8" rx="1.5"/>
    <path d="M19 8.5V10a1.5 1.5 0 0 0 3 0V8.5a1.5 1.5 0 0 0-3 0z"/>
    <rect x="8" y="14" width="3" height="8" rx="1.5"/>
    <path d="M5 15.5V14a1.5 1.5 0 0 0-3 0v1.5a1.5 1.5 0 0 0 3 0z"/>
    <rect x="14" y="13" width="8" height="3" rx="1.5"/>
    <path d="M15.5 19H14a1.5 1.5 0 0 0 0 3h1.5a1.5 1.5 0 0 0 0-3z"/>
    <rect x="2" y="8" width="8" height="3" rx="1.5"/>
    <path d="M8.5 5H10a1.5 1.5 0 0 0 0-3H8.5a1.5 1.5 0 0 0 0 3z"/>
  </svg>
);

interface TabConfig {
  id: SettingsTabType;
  label: string;
  icon: React.FC<{ className?: string }>;
  description: string;
}

const SETTINGS_TABS: TabConfig[] = [
  { id: 'ai', label: 'AI 모델', icon: IconBrain, description: 'Gemini 연동 상태' },
  { id: 'prospect', label: '잠재고객 탐색', icon: IconSparkles, description: 'ICP · 자동 수집' },
  { id: 'slack', label: 'Slack', icon: IconSlack, description: 'Webhook 알림' },
  { id: 'email', label: '이메일', icon: IconMail, description: 'Gmail · Outlook' },
  { id: 'calendar', label: '캘린더', icon: IconCalendar, description: 'Google · Outlook' },
  { id: 'notifications', label: '알림', icon: IconBell, description: '브라우저 · 이메일' },
];

interface ConnectionStatus {
  slack?: boolean;
  email?: boolean;
  calendar?: boolean;
}

interface SettingsTabBarProps {
  activeTab: SettingsTabType;
  onTabChange: (tab: SettingsTabType) => void;
  connectionStatus?: ConnectionStatus;
  horizontal?: boolean;
}

const isConnected = (tabId: SettingsTabType, status: ConnectionStatus): boolean => {
  if (tabId === 'slack') return !!status.slack;
  if (tabId === 'email') return !!status.email;
  if (tabId === 'calendar') return !!status.calendar;
  return false;
};

const isConnectable = (tabId: SettingsTabType): boolean =>
  tabId === 'slack' || tabId === 'email' || tabId === 'calendar';

export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({
  activeTab,
  onTabChange,
  connectionStatus = {},
  horizontal = false,
}) => {
  // Horizontal (mobile)
  if (horizontal) {
    return (
      <>
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const connected = isConnectable(tab.id) && isConnected(tab.id, connectionStatus);

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {connected && (
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-emerald-300' : 'bg-emerald-500'
                  }`}
                  aria-label="연결됨"
                />
              )}
            </button>
          );
        })}
      </>
    );
  }

  // Vertical (desktop)
  return (
    <nav className="flex flex-col space-y-1 w-52" aria-label="설정 메뉴">
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const connected = isConnectable(tab.id) && isConnected(tab.id, connectionStatus);

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{tab.label}</span>
                {connected && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
                    aria-label="연결됨"
                  />
                )}
              </div>
              <p
                className={`text-xs mt-0.5 truncate ${
                  isActive ? 'text-indigo-500' : 'text-slate-500'
                }`}
              >
                {tab.description}
              </p>
            </div>
          </button>
        );
      })}
    </nav>
  );
};
