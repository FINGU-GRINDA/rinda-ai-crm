import React from 'react';
import { IconLoader } from './Icons';

/**
 * Loading States - Skeleton loaders and spinners
 */

// Card skeleton
export const CardSkeleton: React.FC = () => (
  <div className="bg-white p-4 rounded-lg border border-slate-200 animate-pulse">
    <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
    <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
    <div className="h-3 bg-slate-200 rounded w-full" />
  </div>
);

// Text skeleton
export const TextSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-3 bg-slate-200 rounded"
        style={{ width: `${Math.random() * 30 + 70}%` }}
      />
    ))}
  </div>
);

// Page spinner
export const PageSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full p-12">
    <IconLoader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
    {message && (
      <p className="text-sm text-slate-600">{message}</p>
    )}
  </div>
);

// Inline spinner
export const InlineSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeMap = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <IconLoader className={`${sizeMap[size]} animate-spin text-current`} />
  );
};
