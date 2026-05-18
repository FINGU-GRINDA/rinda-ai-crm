import type React from "react"
import { IconCalendar, IconLightbulb, IconSparkles, IconUsers } from "./Icons"

export type TabType = "customers" | "prospects" | "meetings" | "icp"

interface TabNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  counts: {
    customers: number
    prospects: number
    meetings: number
    icp: number
  }
  // Per-tab "in progress" indicator (e.g. icp tab when AI discovery is running).
  busy?: Partial<Record<TabType, boolean>>
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  counts,
  busy,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: "customers",
      label: "고객 관리",
      icon: <IconUsers className="w-4 h-4" />,
      count: counts.customers,
    },
    {
      id: "prospects",
      label: "프로스펙트",
      icon: <IconSparkles className="w-4 h-4" />,
      count: counts.prospects,
    },
    {
      id: "meetings",
      label: "미팅",
      icon: <IconCalendar className="w-4 h-4" />,
      count: counts.meetings,
    },
    {
      id: "icp",
      label: "발굴 고객",
      icon: <IconLightbulb className="w-4 h-4" />,
      count: counts.icp,
    },
  ]

  return (
    <div className="bg-white border-b border-slate-200 px-4 md:px-6 overflow-x-auto scrollbar-hide">
      <div role="tablist" aria-label="고객 카테고리" className="flex space-x-1 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            onClick={() => onTabChange(tab.id)}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`
              relative px-4 py-3 text-sm font-medium transition-all duration-200
              flex items-center gap-2 whitespace-nowrap min-h-[48px]
              ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              aria-label={`${tab.count}개 항목`}
              className={`
                ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
                ${
                  activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                }
              `}
            >
              {tab.count}
            </span>
            {busy?.[tab.id] && (
              <span className="relative inline-flex h-2 w-2" aria-label="진행 중" title="진행 중">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
