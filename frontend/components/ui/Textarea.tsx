import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  autosaveHint?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  hint,
  error,
  autosaveHint,
  className = '',
  id,
  ...rest
}) => {
  const textareaId = id || React.useId();
  const hintId = hint || error ? `${textareaId}-desc` : undefined;
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        {autosaveHint && (
          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {autosaveHint}
          </span>
        )}
      </div>
      <textarea
        id={textareaId}
        aria-invalid={hasError || undefined}
        aria-describedby={hintId}
        className={`
          w-full px-3 py-2.5 rounded-lg border text-sm transition-all outline-none resize-none
          ${hasError
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
          disabled:bg-slate-100 disabled:cursor-not-allowed
          placeholder:text-slate-400
          ${className}
        `}
        {...rest}
      />
      {(hint || error) && (
        <p id={hintId} className={`mt-1 text-xs ${hasError ? 'text-red-600' : 'text-slate-500'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
};
