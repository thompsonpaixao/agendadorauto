import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  variant?: "default" | "error" | "warning" | "success" | "primary";
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = "default",
  className,
}: MetricCardProps) {
  const variantStyles = {
    default: "border-slate-200/80 bg-white",
    error: "border-rose-200/80 bg-rose-50/30",
    warning: "border-amber-200/80 bg-amber-50/30",
    success: "border-emerald-200/80 bg-emerald-50/30",
    primary: "border-indigo-200/80 bg-indigo-50/30",
  };

  const iconBgStyles = {
    default: "bg-slate-100 text-slate-700",
    error: "bg-rose-100 text-rose-700",
    warning: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    primary: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div
      className={cn(
        "p-5 rounded-2xl border shadow-xs transition-all hover:shadow-md",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">
          {title}
        </span>
        {icon && (
          <div className={cn("p-2 rounded-xl text-sm flex items-center justify-center", iconBgStyles[variant])}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded-md",
              trend.isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 leading-normal">
          {subtitle}
        </p>
      )}
    </div>
  );
}
