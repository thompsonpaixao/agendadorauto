"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Film,
  Layers,
  Clock,
  Trash2,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function NotificacoesPage() {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useAppState();

  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "publish_success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "publish_error":
        return <AlertCircle className="w-5 h-5 text-rose-600" />;
      case "token_expired":
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case "account_reconnected":
        return <RefreshCw className="w-5 h-5 text-indigo-600" />;
      case "queue_completed":
        return <Film className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Central de Notificações
            </h1>
            {unreadNotificationsCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                {unreadNotificationsCount} novas
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Acompanhe avisos de publicações, alertas de tokens e eventos automáticos do sistema.
          </p>
        </div>

        {unreadNotificationsCount > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsAsRead}
            className="py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-indigo-600" />
            <span>Marcar todas como lidas</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filter === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Todas as notificações
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filter === "unread" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Não lidas ({unreadNotificationsCount})
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Nenhuma notificação encontrada
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Você será avisado aqui sobre publicações concluídas, alertas de token e novos eventos.
            </p>
          </div>
        ) : (
          filtered.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationAsRead(notif.id)}
              className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                notif.read ? "bg-white hover:bg-slate-50/70" : "bg-indigo-50/30 hover:bg-indigo-50/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      {notif.title}
                    </h4>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {formatDateTime(notif.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
