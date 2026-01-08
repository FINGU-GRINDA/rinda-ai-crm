import React, { useState } from 'react';
import { IconLoader, IconCheck, IconX } from './Icons';

interface ButtonProps {
  // Variants
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success';

  // Sizes
  size?: 'sm' | 'md' | 'lg' | 'xl';

  // States
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  success?: boolean;
  error?: boolean;

  // Visual
  icon?: React.ReactNode;
  fullWidth?: boolean;

  // Events
  onClick?: () => void | Promise<void>;

  // Accessibility
  'aria-label'?: string;
  className?: string;

  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  disabled = false,
  success = false,
  error = false,
  icon,
  fullWidth = false,
  onClick,
  className = '',
  children,
  ...rest
}) => {
  const [internalSuccess, setInternalSuccess] = useState(false);
  const [internalError, setInternalError] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;

    try {
      setInternalError(false);
      await onClick?.();

      // Success animation
      setInternalSuccess(true);
      setTimeout(() => setInternalSuccess(false), 2000);
    } catch (err) {
      // Error animation
      setInternalError(true);
      setTimeout(() => setInternalError(false), 600);
      throw err; // Re-throw to allow parent to handle
    }
  };

  const isSuccess = success || internalSuccess;
  const isError = error || internalError;

  // Variant styles
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-blue-600 to-indigo-600
      text-white
      hover:from-blue-700 hover:to-indigo-700
      shadow-md hover:shadow-lg
      border-0
      focus:ring-blue-500
    `,

    secondary: `
      bg-gradient-to-r from-indigo-50 to-blue-50
      border-2 border-indigo-200
      text-indigo-700
      hover:from-indigo-100 hover:to-blue-100
      hover:border-indigo-300
      shadow-sm hover:shadow-md
      focus:ring-indigo-500
    `,

    tertiary: `
      bg-transparent
      border border-slate-200
      text-slate-600
      hover:bg-slate-50
      hover:border-slate-300
      focus:ring-slate-500
    `,

    danger: `
      bg-red-600
      text-white
      hover:bg-red-700
      shadow-md hover:shadow-lg
      border-0
      focus:ring-red-500
    `,

    success: `
      bg-emerald-600
      text-white
      hover:bg-emerald-700
      shadow-md hover:shadow-lg
      border-0
      focus:ring-emerald-500
    `
  };

  // Size styles - optimized for touch targets (44px minimum)
  const sizeStyles = {
    sm: 'py-2 px-3 text-xs min-h-[36px]',
    md: 'py-3 px-4 text-sm min-h-[44px]',
    lg: 'py-3.5 px-6 text-base min-h-[48px]',
    xl: 'py-4 px-8 text-lg min-h-[52px]'
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        relative rounded-lg font-semibold transition-all duration-200
        flex items-center justify-center gap-2
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${loading ? 'cursor-wait' : ''}
        ${!disabled && !loading ? 'hover:scale-105 active:scale-95' : ''}
        ${isSuccess ? '!bg-emerald-600 animate-pulse-success' : ''}
        ${isError ? 'animate-shake !border-red-500' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...rest}
    >
      {/* Loading state */}
      {loading && (
        <>
          <IconLoader className="w-4 h-4 animate-spin" />
          <span>{loadingText || children}</span>
        </>
      )}

      {/* Success state */}
      {!loading && isSuccess && (
        <>
          <IconCheck className="w-4 h-4" />
          <span>완료!</span>
        </>
      )}

      {/* Error state */}
      {!loading && isError && (
        <>
          <IconX className="w-4 h-4" />
          <span>오류 발생</span>
        </>
      )}

      {/* Normal state */}
      {!loading && !isSuccess && !isError && (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};
