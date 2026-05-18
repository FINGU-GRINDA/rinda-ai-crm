import React, { useEffect } from 'react';
import { IconCheck, IconX, IconClock, IconLightbulb } from './Icons';

/**
 * Toast Notification System
 */

interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
  onClose?: () => void;
  action?: () => void;
  actionText?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 3000,
  position = 'top-right',
  onClose,
  action,
  actionText
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
  };

  const typeStyles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    success: <IconCheck className="w-5 h-5 text-emerald-600" />,
    error: <IconX className="w-5 h-5 text-red-600" />,
    warning: <IconClock className="w-5 h-5 text-amber-600" />,
    info: <IconLightbulb className="w-5 h-5 text-blue-600" />
  };

  return (
    <div
      className={`fixed z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right duration-300 ${positionStyles[position]} ${typeStyles[type]}`}
    >
      {icons[type]}
      <span className="text-sm font-medium flex-1">{message}</span>

      {action && actionText && (
        <button
          onClick={action}
          className="text-xs font-semibold underline hover:no-underline ml-2"
        >
          {actionText}
        </button>
      )}

      {onClose && (
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">
          <IconX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Toast container for multiple toasts
interface ToastContainerProps {
  toasts: (ToastProps & { id: string })[];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => (
  <>
    {toasts.map((toast, index) => (
      <div key={toast.id} style={{ top: `${4 + index * 5}rem` }}>
        <Toast {...toast} />
      </div>
    ))}
  </>
);
