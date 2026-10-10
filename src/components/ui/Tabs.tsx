"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("border-b border-slate-200", className)}>
      <nav className="flex space-x-6 overflow-x-auto scrollbar-none" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "py-3.5 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer",
                isActive
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full font-semibold",
                    isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
