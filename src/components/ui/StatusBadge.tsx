import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "connected"
  | "expired"
  | "error"
  | "paused"
  | "scheduled"
  | "delayed"
  | "processing"
  | "retrying"
  | "published"
  | "critical"
  | "warning"
  | "resolved"
  | "active"
  | "completed";

interface StatusBadgeProps {
  status: BadgeVariant | string;
  label?: string;
  className?: string;
  dotOnly?: boolean;
}

export function StatusBadge({ status, label, className, dotOnly = false }: StatusBadgeProps) {
  const configs: Record<string, { bg: string; text: string; border: string; dot: string; defaultLabel: string }> = {
    connected: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
      defaultLabel: "Conectado",
    },
    active: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
      defaultLabel: "Ativa",
    },
    published: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
      defaultLabel: "Publicado",
    },
    resolved: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
      defaultLabel: "Resolvido",
    },
    scheduled: {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border: "border-indigo-200",
      dot: "bg-indigo-500",
      defaultLabel: "Agendado",
    },
    delayed: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
      dot: "bg-amber-500",
      defaultLabel: "Atrasado — aguardando publicação",
    },
    processing: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      dot: "bg-blue-500",
      defaultLabel: "Processando",
    },
    retrying: {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border: "border-indigo-200",
      dot: "bg-indigo-500",
      defaultLabel: "Aguardando nova tentativa",
    },
    expired: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
      defaultLabel: "Token expirado",
    },
    warning: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
      defaultLabel: "Alerta",
    },
    error: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      dot: "bg-rose-500",
      defaultLabel: "Com erro",
    },
    critical: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      dot: "bg-rose-500",
      defaultLabel: "Crítico",
    },
    paused: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-400",
      defaultLabel: "Pausado",
    },
    completed: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
      defaultLabel: "Concluída",
    },
    completed_with_errors: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
      defaultLabel: "Finalizada com erros",
    },
    cancelled: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-400",
      defaultLabel: "Cancelada",
    },
  };

  const config = configs[status] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-500",
    defaultLabel: status,
  };

  if (dotOnly) {
    return <span className={cn("inline-block w-2 h-2 rounded-full", config.dot, className)} />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}
