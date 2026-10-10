"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Search,
  Filter,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  UserPlus,
  ExternalLink,
  Film,
} from "lucide-react";
import Image from "next/image";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";

export default function ReelsPublicadosPage() {
  const { publishedPosts, selectedAccountId, accounts } = useAppState();

  const [searchTerm, setSearchTerm] = useState("");
  const [profileFilter, setProfileFilter] = useState<string>(selectedAccountId);

  const reelsOnly = publishedPosts.filter((p) => p.type === "reel");

  const filtered = reelsOnly.filter((post) => {
    const matchesSearch =
      post.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.accountUsername.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (profileFilter !== "all" && post.accountId !== profileFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Reels Publicados
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
              {filtered.length} publicações
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Histórico completo e métricas de desempenho de todos os vídeos curtos já postados no Instagram.
          </p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por legenda ou @perfil..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="all">Todos os perfis</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                @{acc.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Reels Publicados */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3.5">Mídia & Perfil</th>
                <th className="px-4 py-3.5">Legenda</th>
                <th className="px-4 py-3.5">Data / Hora</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-3 py-3.5 text-right">Views</th>
                <th className="px-3 py-3.5 text-right">Alcance</th>
                <th className="px-3 py-3.5 text-right">Likes</th>
                <th className="px-3 py-3.5 text-right">Comentários</th>
                <th className="px-3 py-3.5 text-right">Shares</th>
                <th className="px-3 py-3.5 text-right">Saves</th>
                <th className="px-3 py-3.5 text-right">Seguidores</th>
                <th className="px-4 py-3.5 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-3">
                        <Film className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Nenhum Reel publicado ainda
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Quando sua primeira fila de Reels for processada, os vídeos postados e suas métricas aparecerão aqui.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Mídia & Perfil */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <Image
                          src={post.thumbnailUrl}
                          alt={post.caption}
                          width={40}
                          height={56}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-indigo-600 block">
                          @{post.accountUsername}
                        </span>
                        <span className="text-[10px] text-slate-400">ID: {post.id}</span>
                      </div>
                    </div>
                  </td>

                  {/* Legenda */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <p className="text-slate-700 truncate leading-relaxed">
                      {post.caption}
                    </p>
                  </td>

                  {/* Data / Hora */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-normal">
                    <div>{formatDate(post.publishedAt)}</div>
                    <div className="text-[10px] text-slate-400">{formatTime(post.publishedAt)}</div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <StatusBadge status="published" />
                  </td>

                  {/* Métricas */}
                  <td className="px-3 py-3.5 text-right font-bold text-slate-900">
                    {formatNumber(post.views)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {formatNumber(post.reach)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {formatNumber(post.likes)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {formatNumber(post.comments)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {formatNumber(post.shares)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {formatNumber(post.saves)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-bold text-emerald-600">
                    +{post.followersGained}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Ver no Instagram"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
