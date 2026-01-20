import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { SettingsTabType } from '../../types';
import { SettingsTabBar } from './SettingsTabBar';
import { IconX, IconSettings, IconLoader } from '../Icons';
import { getSlackSettings } from '../../services/slackIntegrationService';
import { safeGetItem } from '../../src/utils/safeStorage';
import type { MixpanelFormState } from './tabs/MixpanelIntegrationTab';
import type { SlackFormState } from './tabs/SlackIntegrationTab';
import type { AIFormState } from './tabs/AISettingsTab';

// Lazy load tab components
const AISettingsTab = lazy(() => import('./tabs/AISettingsTab').then(m => ({ default: m.AISettingsTab })));
const ProspectSettingsTab = lazy(() => import('./tabs/ProspectSettingsTab').then(m => ({ default: m.ProspectSettingsTab })));
const SlackIntegrationTab = lazy(() => import('./tabs/SlackIntegrationTab').then(m => ({ default: m.SlackIntegrationTab })));
const EmailIntegrationTab = lazy(() => import('./tabs/EmailIntegrationTab').then(m => ({ default: m.EmailIntegrationTab })));
const CalendarIntegrationTab = lazy(() => import('./tabs/CalendarIntegrationTab').then(m => ({ default: m.CalendarIntegrationTab })));
const NotificationSettingsTab = lazy(() => import('./tabs/NotificationSettingsTab').then(m => ({ default: m.NotificationSettingsTab })));
const MixpanelIntegrationTab = lazy(() => import('./tabs/MixpanelIntegrationTab').then(m => ({ default: m.MixpanelIntegrationTab })));

interface UnifiedSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabType;
  onSettingsChange?: () => void;
  existingCompanyNames?: string[];
}

// Loading spinner for lazy loaded tabs
const TabLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

export const UnifiedSettings: React.FC<UnifiedSettingsProps> = ({
  isOpen,
  onClose,
  initialTab = 'ai',
  onSettingsChange,
  existingCompanyNames = [],
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabType>(initialTab);
  const [connectionStatus, setConnectionStatus] = useState({
    ai: false,
    slack: false,
    email: false,
    calendar: false,
    mixpanel: false,
  });
  const [mixpanelFormState, setMixpanelFormState] = useState<MixpanelFormState | null>(null);
  const [slackFormState, setSlackFormState] = useState<SlackFormState | null>(null);
  const [aiFormState, setAiFormState] = useState<AIFormState | null>(null);

  const handleMixpanelFormStateChange = useCallback((state: MixpanelFormState | null) => {
    setMixpanelFormState(state);
  }, []);

  const handleSlackFormStateChange = useCallback((state: SlackFormState | null) => {
    setSlackFormState(state);
  }, []);

  const handleAiFormStateChange = useCallback((state: AIFormState | null) => {
    setAiFormState(state);
  }, []);

  // Get the active form state based on current tab
  const activeFormState = activeTab === 'mixpanel' ? mixpanelFormState :
                          activeTab === 'slack' ? slackFormState :
                          activeTab === 'ai' ? aiFormState : null;

  // Update connection status on open and when settings change
  const updateConnectionStatus = () => {
    const emailSettings = safeGetItem<{ isConnected?: boolean }>('rinda_email_settings', {});
    const calendarSettings = safeGetItem<{ isConnected?: boolean }>('rinda_calendar_settings', {});
    const mixpanelSettings = safeGetItem<{ isEnabled?: boolean }>('rinda_mixpanel_settings', {});

    setConnectionStatus({
      ai: false, // AI key is now managed server-side only
      slack: getSlackSettings().isValidated,
      email: emailSettings.isConnected || false,
      calendar: calendarSettings.isConnected || false,
      mixpanel: mixpanelSettings.isEnabled || false,
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateConnectionStatus();
      // Reset to initial tab when opening
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSettingsChange = () => {
    updateConnectionStatus();
    onSettingsChange?.();
  };

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai':
        return (
          <AISettingsTab
            onSettingsChange={handleSettingsChange}
            onFormStateChange={handleAiFormStateChange}
          />
        );
      case 'prospect':
        return (
          <ProspectSettingsTab
            onSettingsChange={handleSettingsChange}
            existingCompanyNames={existingCompanyNames}
          />
        );
      case 'slack':
        return (
          <SlackIntegrationTab
            onSettingsChange={handleSettingsChange}
            onFormStateChange={handleSlackFormStateChange}
          />
        );
      case 'email':
        return <EmailIntegrationTab onSettingsChange={handleSettingsChange} />;
      case 'calendar':
        return <CalendarIntegrationTab onSettingsChange={handleSettingsChange} />;
      case 'notifications':
        return <NotificationSettingsTab onSettingsChange={handleSettingsChange} />;
      case 'mixpanel':
        return (
          <MixpanelIntegrationTab
            onSettingsChange={handleSettingsChange}
            onFormStateChange={handleMixpanelFormStateChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-xl shadow-2xl w-full md:max-w-4xl h-[95vh] md:h-auto md:max-h-[90vh] animate-slide-in-from-bottom md:animate-in md:zoom-in-95 duration-300 flex flex-col safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (Mobile Only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 md:p-6 py-3 md:py-6 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <IconSettings className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">설정</h2>
              <p className="text-xs text-slate-500 mt-0.5 hidden md:block">RINDA CRM 설정을 관리합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors touch-target"
            aria-label="닫기"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Tab Bar */}
        <div className="md:hidden border-b border-slate-200 overflow-x-auto scrollbar-hide">
          <div className="flex px-4 py-2 gap-2 min-w-max">
            <SettingsTabBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              connectionStatus={connectionStatus}
              horizontal={true}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden md:block p-4 border-r border-slate-200 flex-shrink-0 overflow-y-auto">
            <SettingsTabBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              connectionStatus={connectionStatus}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <Suspense fallback={<TabLoader />}>
              {renderTabContent()}
            </Suspense>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          {activeFormState?.isDirty ? (
            <>
              <button
                onClick={activeFormState.onReset}
                disabled={activeFormState.isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={activeFormState.onSave}
                disabled={activeFormState.isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {activeFormState.isSaving && <IconLoader className="w-4 h-4 animate-spin" />}
                {activeFormState.isSaving ? '저장 중...' : '설정 저장'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
