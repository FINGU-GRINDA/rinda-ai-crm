import React from 'react';

interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  level?: 'h2' | 'h3' | 'h4';
  className?: string;
}

const levelStyles = {
  h2: 'text-xl font-bold tracking-tight text-slate-900',
  h3: 'text-base font-bold text-slate-800',
  h4: 'text-sm font-bold text-slate-800',
} as const;

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  level = 'h3',
  className = '',
}) => {
  const Tag = level;
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <Tag className={`flex items-center gap-2 ${levelStyles[level]}`}>
          {icon}
          <span className="truncate">{title}</span>
        </Tag>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};
