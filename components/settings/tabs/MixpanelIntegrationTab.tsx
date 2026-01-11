import React, { useState, useEffect } from 'react';
import { IconCheck, IconX, IconLoader, IconExternalLink, IconCopy } from '../../Icons';

interface MixpanelSettings {
  isEnabled: boolean;
  projectToken: string | null;
  apiSecret: string | null;
  webhookSecret: string | null;
  trackedEvents: string[];
  autoCreateProspect: boolean;
  defaultSignalStrength: 'high' | 'medium' | 'low';
  enrichWithAI: boolean;
}

interface MixpanelIntegrationTabProps {
  onSettingsChange?: () => void;
}

const API_BASE = 'http://localhost:3001/api';

export const MixpanelIntegrationTab: React.FC<MixpanelIntegrationTabProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<MixpanelSettings>({
    isEnabled: false,
    projectToken: null,
    apiSecret: null,
    webhookSecret: null,
    trackedEvents: ['$signup', 'sign_up', 'user_signup', 'registration', 'account_created'],
    autoCreateProspect: true,
    defaultSignalStrength: 'medium',
    enrichWithAI: true
  });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [copied, setCopied] = useState(false);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
    fetchWebhookInfo();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/mixpanel/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch Mixpanel settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWebhookInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/mixpanel/webhook-info`);
      if (response.ok) {
        const data = await response.json();
        setWebhookUrl(data.webhookUrl);
      }
    } catch (error) {
      console.error('Failed to fetch webhook info:', error);
    }
  };

  const handleSaveSettings = async (updates: Partial<MixpanelSettings>) => {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${API_BASE}/mixpanel/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setSuccessMessage('설정이 저장되었습니다.');
        onSettingsChange?.();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || '설정 저장에 실패했습니다.');
      }
    } catch (error) {
      setErrorMessage('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    const newSettings = { ...settings, isEnabled: enabled };
    setSettings(newSettings);
    await handleSaveSettings({ isEnabled: enabled });
  };

  const handleToggleAutoCreate = async (autoCreate: boolean) => {
    const newSettings = { ...settings, autoCreateProspect: autoCreate };
    setSettings(newSettings);
    await handleSaveSettings({ autoCreateProspect: autoCreate });
  };

  const handleToggleAIEnrich = async (enrichWithAI: boolean) => {
    const newSettings = { ...settings, enrichWithAI };
    setSettings(newSettings);
    await handleSaveSettings({ enrichWithAI });
  };

  const handleAddEvent = async () => {
    if (!newEvent.trim()) return;
    if (settings.trackedEvents.includes(newEvent.trim())) {
      setErrorMessage('이미 추가된 이벤트입니다.');
      return;
    }

    const updatedEvents = [...settings.trackedEvents, newEvent.trim()];
    const newSettings = { ...settings, trackedEvents: updatedEvents };
    setSettings(newSettings);
    setNewEvent('');
    await handleSaveSettings({ trackedEvents: updatedEvents });
  };

  const handleRemoveEvent = async (eventToRemove: string) => {
    const updatedEvents = settings.trackedEvents.filter(e => e !== eventToRemove);
    const newSettings = { ...settings, trackedEvents: updatedEvents };
    setSettings(newSettings);
    await handleSaveSettings({ trackedEvents: updatedEvents });
  };

  const handleWebhookSecretChange = async (secret: string) => {
    await handleSaveSettings({ webhookSecret: secret || null });
  };

  const handleSignalStrengthChange = async (strength: 'high' | 'medium' | 'low') => {
    const newSettings = { ...settings, defaultSignalStrength: strength };
    setSettings(newSettings);
    await handleSaveSettings({ defaultSignalStrength: strength });
  };

  const handleTest = async () => {
    setIsTesting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${API_BASE}/mixpanel/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: '$signup',
          email: 'test@example.com',
          name: 'Test User',
          company: 'Test Company Inc.'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.result.action === 'prospect_created') {
          setSuccessMessage('테스트 성공! 새로운 Prospect가 생성되었습니다.');
        } else if (data.result.action?.includes('updated')) {
          setSuccessMessage('테스트 성공! 기존 데이터가 업데이트되었습니다.');
        } else {
          setSuccessMessage(`테스트 완료: ${data.result.reason || '처리됨'}`);
        }
      } else {
        setErrorMessage(data.error || '테스트에 실패했습니다.');
      }
    } catch (error) {
      setErrorMessage('테스트 중 오류가 발생했습니다.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Mixpanel 연동</h3>
        <p className="text-sm text-slate-500">Mixpanel에서 신규 유저 이벤트를 수신하여 자동으로 CRM에 등록합니다.</p>
      </div>

      {/* Connection Status */}
      {settings.isEnabled && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <IconCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-900">Mixpanel 연동 활성화됨</span>
          </div>
        </div>
      )}

      {/* Webhook URL */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Webhook URL (Mixpanel에 등록)
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50"
            />
          </div>
          <button
            onClick={handleCopyWebhookUrl}
            className="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <IconCheck className="w-4 h-4 text-emerald-600" />
                복사됨
              </>
            ) : (
              <>
                <IconCopy className="w-4 h-4" />
                복사
              </>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          이 URL을 Mixpanel Webhook 설정에 추가하세요.
        </p>
      </div>

      {/* Webhook Secret (Optional) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Webhook Secret (선택사항)
        </label>
        <input
          type="password"
          placeholder="Mixpanel Webhook Secret"
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onBlur={(e) => handleWebhookSecretChange(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          보안 강화를 위해 Mixpanel에서 설정한 Webhook Secret을 입력하세요.
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-slate-900">Mixpanel 연동 활성화</h4>
            <p className="text-xs text-slate-500">활성화하면 Mixpanel 이벤트를 수신합니다.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Tracked Events */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-900">추적할 이벤트</h4>
        <p className="text-xs text-slate-500">이 이벤트가 발생하면 CRM에 자동으로 Prospect를 생성합니다.</p>

        <div className="flex flex-wrap gap-2">
          {settings.trackedEvents.map((event) => (
            <span
              key={event}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 text-sm rounded-full"
            >
              {event}
              <button
                onClick={() => handleRemoveEvent(event)}
                className="hover:text-indigo-600"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newEvent}
            onChange={(e) => setNewEvent(e.target.value)}
            placeholder="새 이벤트명 (예: user_registered)"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddEvent()}
          />
          <button
            onClick={handleAddEvent}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      {/* Auto Create Prospect */}
      <div className="space-y-4">
        <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
          <div>
            <span className="text-sm font-medium text-slate-700">자동 Prospect 생성</span>
            <p className="text-xs text-slate-500">신규 유저가 감지되면 자동으로 Prospect 생성</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoCreateProspect}
            onChange={(e) => handleToggleAutoCreate(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
          <div>
            <span className="text-sm font-medium text-slate-700">AI 자동 분석</span>
            <p className="text-xs text-slate-500">회사 정보를 AI로 자동 분석하여 보강</p>
          </div>
          <input
            type="checkbox"
            checked={settings.enrichWithAI}
            onChange={(e) => handleToggleAIEnrich(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
        </label>
      </div>

      {/* Default Signal Strength */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          기본 Signal Strength
        </label>
        <select
          value={settings.defaultSignalStrength}
          onChange={(e) => handleSignalStrengthChange(e.target.value as 'high' | 'medium' | 'low')}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="high">High - 높은 관심 고객</option>
          <option value="medium">Medium - 일반 관심 고객</option>
          <option value="low">Low - 낮은 관심 고객</option>
        </select>
        <p className="mt-1.5 text-xs text-slate-500">
          데이터가 충분하지 않을 경우 적용되는 기본값입니다.
        </p>
      </div>

      {/* Test Button */}
      <div className="border-t border-slate-200 pt-6">
        <button
          onClick={handleTest}
          disabled={isTesting || !settings.isEnabled}
          className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isTesting ? (
            <>
              <IconLoader className="w-4 h-4 animate-spin" />
              테스트 중...
            </>
          ) : (
            '테스트 이벤트 전송'
          )}
        </button>
        <p className="mt-1.5 text-xs text-slate-500">
          테스트 Prospect를 생성하여 연동이 정상 작동하는지 확인합니다.
        </p>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center gap-1">
            <IconX className="w-4 h-4" />
            {errorMessage}
          </p>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-600 flex items-center gap-1">
            <IconCheck className="w-4 h-4" />
            {successMessage}
          </p>
        </div>
      )}

      {/* Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-2">Mixpanel Webhook 설정 방법</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Mixpanel 프로젝트 설정 → Integrations → Webhooks로 이동</li>
              <li>위 Webhook URL을 복사하여 추가</li>
              <li>추적할 이벤트 선택 (예: $signup, registration)</li>
              <li>(선택) Webhook Secret 설정 후 위에 입력</li>
            </ol>
            <a
              href="https://docs.mixpanel.com/docs/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              <IconExternalLink className="w-3.5 h-3.5" />
              Mixpanel Webhook 문서 보기
            </a>
          </div>
        </div>
      </div>

      {/* Supported Properties */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-900 mb-2">지원되는 Mixpanel 속성</p>
        <div className="text-xs text-slate-600 space-y-1">
          <p><code className="bg-slate-200 px-1 rounded">$email</code>, <code className="bg-slate-200 px-1 rounded">email</code> - 이메일 주소</p>
          <p><code className="bg-slate-200 px-1 rounded">$name</code>, <code className="bg-slate-200 px-1 rounded">name</code> - 사용자 이름</p>
          <p><code className="bg-slate-200 px-1 rounded">$company</code>, <code className="bg-slate-200 px-1 rounded">company</code> - 회사명</p>
          <p><code className="bg-slate-200 px-1 rounded">$phone</code>, <code className="bg-slate-200 px-1 rounded">phone</code> - 전화번호</p>
          <p><code className="bg-slate-200 px-1 rounded">industry</code> - 산업 분야</p>
          <p><code className="bg-slate-200 px-1 rounded">company_size</code> - 회사 규모</p>
          <p><code className="bg-slate-200 px-1 rounded">utm_source</code>, <code className="bg-slate-200 px-1 rounded">utm_campaign</code> - 유입 경로</p>
        </div>
      </div>
    </div>
  );
};
