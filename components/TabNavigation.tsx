import React from 'react';
import { IconBriefcase, IconUsers, IconX } from './Icons';

export type TabType = 'active' | 'leads' | 'lost';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: {
    active: number;
    leads: number;
    lost: number;
  };
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  counts
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: 'active',
      label: '활성 Deal',
      icon: <IconBriefcase className="w-4 h-4" />,
      count: counts.active
    },
    {
      id: 'leads',
      label: '잠재 고객',
      icon: <IconUsers className="w-4 h-4" />,
      count: counts.leads
    },
    {
      id: 'lost',
      label: 'Lost Deals',
      icon: <IconX className="w-4 h-4" />,
      count: counts.lost
    }
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 md:px-6 overflow-x-auto scrollbar-hide">
      <div className="flex space-x-1 min-w-max">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative px-4 py-3 text-sm font-medium transition-all duration-200
              flex items-center gap-2 whitespace-nowrap min-h-[48px]
              ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`
                ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
                ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }
              `}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};



