import React from 'react';
import { aiSurface } from '../../styles/design-tokens';

interface CardProps {
  tone?: 'default' | 'muted' | 'ai';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
}

const paddingStyles = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const;

const toneStyles = {
  default: 'bg-white border border-slate-200 shadow-sm',
  muted: 'bg-slate-50 border border-slate-200',
  ai: aiSurface,
} as const;

export const Card: React.FC<CardProps> = ({
  tone = 'default',
  padding = 'md',
  className = '',
  children,
  as: Tag = 'div',
}) => {
  return (
    <Tag className={`rounded-xl ${toneStyles[tone]} ${paddingStyles[padding]} ${className}`}>
      {children}
    </Tag>
  );
};
