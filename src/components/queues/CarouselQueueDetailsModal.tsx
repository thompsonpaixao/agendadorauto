"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatTime } from "@/lib/utils";
import {
  Layers,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";

interface CarouselQueueDetailsModalProps {
  queueId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface CarouselItemDetail {
  id: string;
  queueId: string;
  carouselId: string;
  title: string;
  caption: string;
  position: number;
  status: "pending" | "scheduled" | "processing" | "published" | "failed" | "cancelled";
  scheduledAt: string | null;
  slidesCount: number;
  slides: {
    id: string;
    position: number;
    name: string;
    thumbnailUrl: string;
    sizeBytes: number;
  }[];
  thumbnailUrl: string;
  friendlyError?: string | null;
  technicalDetails?: Record<string, any> | null;
}

interface QueueDetailData {
  queue: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    postsPerDay: number;
    dailyTimes: string[];
    createdAt: string;
    account: {
      id: string;
      username: string;
      name: string;
      profilePicture: string;
    };
  };
  summary: {
    total: number;
    published: number;
    scheduled: number;
    failed: number;
    cancelled: number;
    remaining: number;
  };
  items: CarouselItemDetail[];
}

export function CarouselQueueDetailsModal({
  queueId,
  isOpen,
  onClose,
  onUpdate,
}: CarouselQueueDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QueueDetailData | null>(null);
  const [expandedErrorIds, setExpandedErrorIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !queueId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/carousel-queues/${queueId}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success) {
          setData(json);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar detalhes da fila de carrosséis:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, queueId]);

  const toggleTechnicalDetails = (itemId: string) => {
    setExpandedErrorIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data ? data.queue.name : "Detalhes da Fila de Carrosséis"}
      description={data ? `Perfil @${data.queue.account.username} • Criada em ${formatDate(data.queue.createdAt)}` : undefined}
      maxWidth="2xl"
    >
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Carregando relatório da fila...</p>
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          Não foi possível carregar os detalhes desta fila de carrosséis.
        </div>
      ) : (
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          {/* Barra de Métricas Consolidadas */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
            <div className="p-2">
              <span className="text-[11px] font-semibold text-slate-500 block">Total</span>
              <strong className="text-sm font-bold text-slate-900">{data.summary.total}</strong>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-semibold text-emerald-600 block">Publicados</span>
              <strong className="text-sm font-bold text-emerald-700">{data.summary.published}</strong>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-semibold text-indigo-600 block">Agendados</span>
              <strong className="text-sm font-bold text-indigo-700">{data.summary.scheduled}</strong>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-semibold text-rose-600 block">Falhas</span>
              <strong className="text-sm font-bold text-rose-700">{data.summary.failed}</strong>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-semibold text-slate-500 block">Cancelados</span>
              <strong className="text-sm font-bold text-slate-700">{data.summary.cancelled}</strong>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-semibold text-slate-500 block">Restantes</span>
              <strong className="text-sm font-bold text-slate-900">{data.summary.remaining}</strong>
            </div>
          </div>

          {/* Dados de Agendamento da Fila */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-1 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Início: <strong>{formatDate(data.queue.startDate)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>
                Frequência: <strong>{data.queue.postsPerDay}x ao dia</strong> ({data.queue.dailyTimes.join(", ")})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Status atual:</span>
              <StatusBadge status={data.queue.status as any} />
            </div>
          </div>

          {/* Relatório Individual de Carrosséis */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Carrosséis da Fila ({data.items.length})
            </h4>

            {data.items.map((item) => {
              const isError = item.status === "failed";
              const isExpanded = Boolean(expandedErrorIds[item.id]);

              return (
                <div
                  key={item.id}
                  className={`border rounded-2xl p-4 transition-all ${
                    isError
                      ? "border-rose-300 bg-rose-50/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-200">
                        {item.thumbnailUrl ? (
                          <Image
                            src={item.thumbnailUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/85 text-white px-1 rounded font-bold">
                          {item.slidesCount} slides
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">#{item.position}</span>
                          <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.scheduledAt
                            ? `${formatDate(item.scheduledAt)} às ${formatTime(item.scheduledAt)}`
                            : "Horário não definido"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <StatusBadge status={item.status as any} />
                    </div>
                  </div>

                  {/* Prévia dos Slides */}
                  {item.slides && item.slides.length > 1 && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 overflow-x-auto">
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0 mr-1">Slides:</span>
                      {item.slides.map((s, idx) => (
                        <div
                          key={s.id || idx}
                          className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-200"
                          title={`Slide ${idx + 1}: ${s.name}`}
                        >
                          {s.thumbnailUrl && (
                            <Image
                              src={s.thumbnailUrl}
                              alt={s.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Detalhes de Erro se falhou */}
                  {isError && (
                    <div className="mt-3 pt-3 border-t border-rose-200 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-rose-900">Motivo da Falha:</strong>
                          <span>{item.friendlyError || "Ocorreu um erro no processamento do carrossel pelo Instagram."}</span>
                        </div>
                      </div>

                      {item.technicalDetails && (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleTechnicalDetails(item.id)}
                            className="text-[11px] text-rose-700 hover:text-rose-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {isExpanded && (
                            <pre className="mt-2 p-3 bg-slate-900 text-rose-300 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(item.technicalDetails, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
