import React, { useState, useEffect } from 'react';
import { IconX, IconEye, IconEyeOff, IconCheck, IconLoader, IconExternalLink, IconKey } from './Icons';

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentMaskedKey, setCurrentMaskedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // 상태 초기화
      setApiKey('');
      setErrorMessage('');
      setValidationStatus('idle');
    }
  }, [isOpen]);

  // Debounced validation
  useEffect(() => {
    if (apiKey.length < 20) {
      setValidationStatus('idle');
      return;
    }

    const timer = setTimeout(() => {
      validateApiKey();
    }, 500);

    return () => clearTimeout(timer);
  }, [apiKey]);

  const validateApiKey = async () => {
    setErrorMessage('API Key 관리가 서버로 이동되었습니다. 서버 환경설정을 확인해주세요.');
  };

  const handleSave = async () => {
    if (validationStatus === 'valid') {
      onClose();
    } else if (apiKey.length > 0) {
      await validateApiKey();
    }
  };

  const handleClear = () => {
    setCurrentMaskedKey(null);
    setApiKey('');
    setValidationStatus('idle');
    setErrorMessage('');
  };

  if (!isOpen) return null;

  const isConfigured = false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <IconKey className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Gemini API Key 설정</h2>
              <p className="text-xs text-slate-500 mt-0.5">AI 기능 사용을 위한 API Key를 설정하세요</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Current Status */}
          {currentMaskedKey && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <IconCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-900">현재 상태: API Key 설정됨</span>
                  </div>
                  <p className="text-xs text-emerald-700 font-mono">{currentMaskedKey}</p>
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

          {!isConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">API Key가 설정되지 않았습니다</p>
                  <p className="text-xs text-amber-700">
                    데이터 분석, 제안서 생성 등 AI 기능을 사용하려면 API Key가 필요합니다.
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
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className={`w-full px-4 py-3 pr-24 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 transition-all ${
                  validationStatus === 'valid'
                    ? 'border-emerald-300 bg-emerald-50 focus:ring-emerald-500'
                    : validationStatus === 'invalid'
                    ? 'border-red-300 bg-red-50 focus:ring-red-500'
                    : 'border-slate-300 bg-white focus:ring-blue-500'
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Validation Status Icon */}
                {validationStatus === 'validating' && (
                  <IconLoader className="w-5 h-5 text-blue-600 animate-spin" />
                )}
                {validationStatus === 'valid' && (
                  <IconCheck className="w-5 h-5 text-emerald-600" />
                )}
                {validationStatus === 'invalid' && (
                  <IconX className="w-5 h-5 text-red-600" />
                )}

                {/* Toggle Visibility */}
                <button
                  type="button"
                  onClick={() => setIsVisible(!isVisible)}
                  className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                >
                  {isVisible ? (
                    <IconEyeOff className="w-4 h-4 text-slate-400" />
                  ) : (
                    <IconEye className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <IconX className="w-3 h-3" />
                {errorMessage}
              </p>
            )}

            {/* Valid Message */}
            {validationStatus === 'valid' && (
              <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                <IconCheck className="w-3 h-3" />
                유효한 API Key입니다!
              </p>
            )}

            {/* Validation in progress */}
            {validationStatus === 'validating' && (
              <p className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                <IconLoader className="w-3 h-3 animate-spin" />
                API Key를 검증하는 중입니다
              </p>
            )}
          </div>

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

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <div className="flex items-center gap-2">
            {apiKey.length > 0 && validationStatus !== 'valid' && (
              <button
                onClick={validateApiKey}
                disabled={isValidating}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? '검증하는 중입니다' : '검증하기'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={apiKey.length > 0 && validationStatus !== 'valid'}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {validationStatus === 'valid' ? '저장하기' : '확인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
