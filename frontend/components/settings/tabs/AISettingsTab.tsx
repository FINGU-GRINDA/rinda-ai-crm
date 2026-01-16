import React, { useState, useEffect } from 'react';
import { IconEye, IconEyeOff, IconCheck, IconLoader, IconExternalLink, IconX } from '../../Icons';
import GeminiAPIManager from '../../../services/geminiApiManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AIFormState {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => Promise<void>;
  onReset: () => void;
}

interface AISettingsTabProps {
  onSettingsChange?: () => void;
  onFormStateChange?: (state: AIFormState | null) => void;
}

interface ServerAIStatus {
  available: boolean;
  serverKeyConfigured: boolean;
  model: string;
}

export const AISettingsTab: React.FC<AISettingsTabProps> = ({ onSettingsChange, onFormStateChange }) => {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentMaskedKey, setCurrentMaskedKey] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerAIStatus | null>(null);
  const [isLoadingServerStatus, setIsLoadingServerStatus] = useState(true);

  // Track if form has unsaved changes
  const isDirty = apiKey.trim().length > 0;

  useEffect(() => {
    // 현재 설정된 API Key 확인
    const masked = GeminiAPIManager.getInstance().getMaskedApiKey();
    setCurrentMaskedKey(masked);

    // 서버 AI 상태 확인
    fetchServerStatus();
  }, []);

  const fetchServerStatus = async () => {
    setIsLoadingServerStatus(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/status`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setServerStatus(result.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch server AI status:', error);
    } finally {
      setIsLoadingServerStatus(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('API Key를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (apiKey.length < 20) {
      setErrorMessage('API Key가 너무 짧습니다.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const result = await GeminiAPIManager.getInstance().setApiKey(apiKey);

    if (result.success) {
      setSuccessMessage('API Key가 저장되었습니다!');
      setErrorMessage('');
      setCurrentMaskedKey(GeminiAPIManager.getInstance().getMaskedApiKey());
      setApiKey(''); // Clear input after successful save
      onSettingsChange?.();
    } else {
      setErrorMessage(result.error || '유효하지 않은 API Key입니다.');
      setSuccessMessage('');
    }

    setIsSaving(false);
  };

  const handleReset = () => {
    setApiKey('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Report form state to parent component
  useEffect(() => {
    if (onFormStateChange) {
      if (isDirty) {
        onFormStateChange({
          isDirty,
          isSaving,
          onSave: handleSave,
          onReset: handleReset,
        });
      } else {
        onFormStateChange(null);
      }
    }
  }, [isDirty, isSaving, onFormStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onFormStateChange?.(null);
    };
  }, [onFormStateChange]);

  const handleClear = () => {
    GeminiAPIManager.getInstance().clearApiKey();
    setCurrentMaskedKey(null);
    setApiKey('');
    setErrorMessage('');
    setSuccessMessage('');
    onSettingsChange?.();
  };

  const isConfigured = GeminiAPIManager.getInstance().isApiKeyConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Gemini API 설정</h3>
        <p className="text-sm text-slate-500">AI 기능 사용을 위한 Google Gemini API Key를 설정하세요.</p>
      </div>

      {/* Server-side API Status */}
      {isLoadingServerStatus ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <IconLoader className="w-4 h-4 text-slate-400 animate-spin" />
            <span className="text-sm text-slate-600">서버 상태 확인 중...</span>
          </div>
        </div>
      ) : serverStatus?.serverKeyConfigured ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🖥️</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconCheck className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-900">서버 API Key 설정됨</span>
              </div>
              <p className="text-xs text-indigo-700">
                서버에 Gemini API Key가 설정되어 있습니다. 서버 측 AI 기능(데이터 보강, 미팅 요약 등)을 사용할 수 있습니다.
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                모델: {serverStatus.model}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🖥️</span>
            <div>
              <span className="text-sm text-slate-600">서버 API Key가 설정되지 않았습니다.</span>
              <p className="text-xs text-slate-500 mt-1">
                서버 측 AI 기능을 사용하려면 서버 환경변수에 GEMINI_API_KEY를 설정하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Client-side API Key Status */}
      {currentMaskedKey && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">브라우저 API Key 설정됨</span>
              </div>
              <p className="text-xs text-emerald-700 font-mono">{currentMaskedKey}</p>
              <p className="text-xs text-emerald-600 mt-1">
                이 키는 브라우저에서 직접 AI 기능을 호출할 때 사용됩니다.
              </p>
            </div>
            <button
              onClick={handleClear}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline"
            >
              제거
            </button>
          </div>
        </div>
      )}

      {!isConfigured && !serverStatus?.serverKeyConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">API Key가 설정되지 않았습니다</p>
              <p className="text-xs text-amber-700">
                AI 기능을 사용하려면 서버 또는 브라우저에 API Key가 필요합니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API Key Input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {currentMaskedKey ? '새 API Key 입력:' : 'API Key 입력:'}
        </label>
        <div className="relative">
          <input
            type={isVisible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setErrorMessage('');
              setSuccessMessage('');
            }}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="AIzaSy..."
            className={`w-full px-4 py-3 pr-12 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 transition-all ${
              errorMessage
                ? 'border-red-300 bg-red-50 focus:ring-red-500'
                : 'border-slate-300 bg-white focus:ring-indigo-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-slate-100 transition-colors"
          >
            {isVisible ? (
              <IconEyeOff className="w-4 h-4 text-slate-400" />
            ) : (
              <IconEye className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
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
            <p className="text-sm font-semibold text-blue-900 mb-2">API Key 발급 방법</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Google AI Studio에 접속하세요</li>
              <li>"Get API Key" 버튼을 클릭하세요</li>
              <li>생성된 API Key를 복사하여 위 입력창에 붙여넣기 하세요</li>
            </ol>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              <IconExternalLink className="w-3.5 h-3.5" />
              Google AI Studio에서 API Key 발급받기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
