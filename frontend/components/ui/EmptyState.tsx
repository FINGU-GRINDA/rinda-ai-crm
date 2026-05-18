import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: { wrap: 'p-6', icon: 'w-10 h-10', title: 'text-sm', desc: 'text-xs' },
  md: { wrap: 'p-8', icon: 'w-12 h-12', title: 'text-sm', desc: 'text-sm' },
  lg: { wrap: 'p-10', icon: 'w-16 h-16', title: 'text-base', desc: 'text-sm' },
} as const;

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}) => {
  const s = sizeStyles[size];
  return (
    <div
      className={`flex flex-col items-center justify-center text-center bg-gradient-to-b from-slate-50 to-white border border-dashed border-slate-300 rounded-xl ${s.wrap} ${className}`}
    >
      {icon && (
        <div className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3 ${s.icon}`}>
          {icon}
        </div>
      )}
      <h4 className={`font-semibold text-slate-700 mb-1 ${s.title}`}>{title}</h4>
      {description && (
        <p className={`text-slate-500 leading-relaxed ${s.desc}`}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
