import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'py-1.5 text-xs min-h-[32px]',
  md: 'py-2.5 text-sm min-h-[40px]',
  lg: 'py-3 text-base min-h-[48px]',
} as const;

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  error,
  leftIcon,
  rightSlot,
  size = 'md',
  className = '',
  id,
  ...inputProps
}) => {
  const inputId = id || React.useId();
  const hintId = hint || error ? `${inputId}-desc` : undefined;
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={hintId}
          className={`
            w-full rounded-lg border transition-all outline-none
            ${leftIcon ? 'pl-10' : 'pl-3'}
            ${rightSlot ? 'pr-10' : 'pr-3'}
            ${sizeStyles[size]}
            ${hasError
              ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
              : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
            disabled:bg-slate-100 disabled:cursor-not-allowed
            placeholder:text-slate-400
            ${className}
          `}
          {...inputProps}
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {rightSlot}
          </span>
        )}
      </div>
      {(hint || error) && (
        <p id={hintId} className={`mt-1 text-xs ${hasError ? 'text-red-600' : 'text-slate-500'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
};
