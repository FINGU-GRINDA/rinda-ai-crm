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

// Mixpanel 아이콘
const IconMixpanel: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="M7 16l4-8 4 5 5-9"/>
  </svg>
);

interface TabConfig {
  id: SettingsTabType;
  label: string;
  icon: React.FC<{ className?: string }>;
  description: string;
}

const SETTINGS_TABS: TabConfig[] = [
  { id: 'ai', label: 'AI 설정', icon: IconBrain, description: 'Gemini API Key' },
  { id: 'prospect', label: '잠재고객 탐색', icon: IconSparkles, description: 'ICP 프로필 및 수집' },
  { id: 'slack', label: 'Slack 연동', icon: IconSlack, description: 'Webhook 알림' },
  { id: 'mixpanel', label: 'Mixpanel 연동', icon: IconMixpanel, description: '유저 이벤트 수신' },
  { id: 'email', label: '이메일 연동', icon: IconMail, description: 'Gmail/Outlook' },
  { id: 'calendar', label: '캘린더 연동', icon: IconCalendar, description: 'Google/Outlook' },
  { id: 'notifications', label: '알림 설정', icon: IconBell, description: '알림 관리' },
];

interface SettingsTabBarProps {
  activeTab: SettingsTabType;
  onTabChange: (tab: SettingsTabType) => void;
  connectionStatus?: {
    ai?: boolean;
    slack?: boolean;
    mixpanel?: boolean;
    email?: boolean;
    calendar?: boolean;
  };
  horizontal?: boolean;
}

export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({
  activeTab,
  onTabChange,
  connectionStatus = {},
  horizontal = false,
}) => {
  const getStatusBadge = (tabId: SettingsTabType) => {
    if (tabId === 'ai' && connectionStatus.ai) {
      return <span className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
    if (tabId === 'slack' && connectionStatus.slack) {
      return <span className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
    if (tabId === 'mixpanel' && connectionStatus.mixpanel) {
      return <span className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
    if (tabId === 'email' && connectionStatus.email) {
      return <span className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
    if (tabId === 'calendar' && connectionStatus.calendar) {
      return <span className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
    return null;
  };

  // Horizontal mode for mobile
  if (horizontal) {
    return (
      <>
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {getStatusBadge(tab.id)}
            </button>
          );
        })}
      </>
    );
  }

  // Vertical mode for desktop
  return (
    <div className="flex flex-col space-y-1 w-48 border-r border-slate-200 pr-4">
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
              ${isActive
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }
            `}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700' : ''}`}>
                  {tab.label}
                </span>
                {getStatusBadge(tab.id)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
