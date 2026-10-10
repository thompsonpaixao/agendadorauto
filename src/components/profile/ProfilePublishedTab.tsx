"use client";

import React, { useState } from "react";
import { Account, PublishedPost } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatTime, formatNumber } from "@/lib/utils";
import {
  Film,
  Layers,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  UserPlus,
  ExternalLink,
  Search,
} from "lucide-react";
import Image from "next/image";

interface ProfilePublishedTabProps {
  account: Account;
  publishedPosts: PublishedPost[];
}

export function ProfilePublishedTab({
  account,
  publishedPosts,
}: ProfilePublishedTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "reel" | "carousel">("all");

  const accountPosts = publishedPosts.filter((p) => p.accountId === account.id);

  const filtered = accountPosts.filter((p) => {
    const matchesSearch = p.caption.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar legenda..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(["all", "reel", "carousel"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`py-1 px-2.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  typeFilter === t
                    ? "bg-white text-indigo-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t === "all" ? "Todos" : t === "reel" ? "Reels" : "Carrosséis"}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          {filtered.length} publicação(ões) realizada(s) em @{account.username}
        </span>
      </div>

      {/* Tabela de Publicações */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5">Mídia & Tipo</th>
                <th className="px-4 py-3.5">Legenda</th>
                <th className="px-4 py-3.5">Data & Hora</th>
                <th className="px-3 py-3.5 text-center">Status</th>
                <th className="px-3 py-3.5 text-right">Views</th>
                <th className="px-3 py-3.5 text-right">Alcance</th>
                <th className="px-3 py-3.5 text-right">Interações</th>
                <th className="px-3 py-3.5 text-right">Seguidores</th>
                <th className="px-4 py-3.5 text-center">Link</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                        <Film className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Nenhum conteúdo publicado ainda em @{account.username}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Assim que seus Reels e carrosséis forem processados pela Meta API, os relatórios e métricas consolidadas aparecerão nesta tabela.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((post) => {
                  const totalInteractions = post.likes + post.comments + post.shares + post.saves;
                  return (
                    <tr key={post.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Mídia & Tipo */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            <Image
                              src={post.thumbnailUrl}
                              alt={post.caption}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              post.type === "reel" ? "bg-rose-100 text-rose-700" : "bg-purple-100 text-purple-700"
                            }`}>
                              {post.type === "reel" ? "Reel" : "Carrossel"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Legenda */}
                      <td className="px-4 py-3.5 max-w-xs truncate text-slate-700">
                        {post.caption}
                      </td>

                      {/* Data & Hora */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-normal">
                        <div>{formatDate(post.publishedAt)}</div>
                        <div className="text-[10px] text-slate-400">{formatTime(post.publishedAt)}</div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 text-center">
                        <StatusBadge status="published" />
                      </td>

                      {/* Views */}
                      <td className="px-3 py-3.5 text-right font-bold text-slate-900">
                        {formatNumber(post.views)}
                      </td>

                      {/* Alcance */}
                      <td className="px-3 py-3.5 text-right text-slate-700">
                        {formatNumber(post.reach)}
                      </td>

                      {/* Interações */}
                      <td className="px-3 py-3.5 text-right text-slate-700">
                        <div className="font-bold text-slate-800">{formatNumber(totalInteractions)}</div>
                        <div className="text-[10px] text-slate-400">
                          {post.likes} L • {post.saves} S
                        </div>
                      </td>

                      {/* Seguidores */}
                      <td className="px-3 py-3.5 text-right font-bold text-emerald-600">
                        +{post.followersGained}
                      </td>

                      {/* Ações / Link Ver Publicação */}
                      <td className="px-4 py-3.5 text-center">
                        <a
                          href={post.permalink || `https://www.instagram.com/${account.username}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                          title={post.permalink ? "Ver publicação oficial no Instagram" : "Ver perfil no Instagram"}
                        >
                          <span>Ver publicação</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
