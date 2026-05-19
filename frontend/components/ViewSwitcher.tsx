import type React from "react"
import { IconGrid, IconTable } from "./Icons"

export type ViewMode = "kanban" | "table"

interface ViewSwitcherProps {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="inline-flex items-center bg-neutral-100 rounded-lg p-1 gap-1">
      <button
        onClick={() => onViewChange("kanban")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          currentView === "kanban"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
        aria-label="칸반 뷰"
      >
        <IconGrid className="w-4 h-4" />
        <span className="hidden sm:inline">칸반</span>
      </button>
      <button
        onClick={() => onViewChange("table")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          currentView === "table"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
        aria-label="테이블 뷰"
      >
        <IconTable className="w-4 h-4" />
        <span className="hidden sm:inline">테이블</span>
      </button>
    </div>
  )
}
