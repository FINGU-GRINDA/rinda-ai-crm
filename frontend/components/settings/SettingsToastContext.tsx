import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconCheck, IconX } from '../Icons';

type ToastKind = 'success' | 'error';

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

interface SettingsToastValue {
  show: (kind: ToastKind, message: string) => void;
}

const SettingsToastCtx = createContext<SettingsToastValue | null>(null);

export const useSettingsToast = (): SettingsToastValue => {
  const v = useContext(SettingsToastCtx);
  if (!v) throw new Error('useSettingsToast must be used inside SettingsToastProvider');
  return v;
};

interface ProviderProps {
  children: React.ReactNode;
}

const TOAST_DURATION_MS = 2400;

export const SettingsToastProvider: React.FC<ProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback((kind: ToastKind, message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToast({ id, kind, message });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <SettingsToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 bottom-20 md:bottom-6 flex justify-center px-4 z-10"
        >
          <div
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              toast.kind === 'success'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-red-600 text-white border-red-600'
            }`}
          >
            {toast.kind === 'success' ? (
              <IconCheck className="w-4 h-4 flex-shrink-0" />
            ) : (
              <IconX className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={dismiss}
              className="ml-2 -mr-1 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="알림 닫기"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </SettingsToastCtx.Provider>
  );
};
