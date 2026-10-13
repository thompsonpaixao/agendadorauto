"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { PublishedPost } from "@/types";
import {
  ArrowUpDown,
  Search,
  ExternalLink,
  Eye,
  TrendingUp,
  Heart,
  Share2,
  Bookmark,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { formatNumber, formatDate } from "@/lib/utils";

type SortField =
  | "views"
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "profileVisits"
  | "followersGained"
  | "avgWatchTimeSeconds";

export default function AnalyticsConteudoPage() {
  const { publishedPosts, accounts, selectedAccountId } = useAppState();

  const [typeFilter, setTypeFilter] = useState<"all" | "reel" | "carousel">("all");
  const [profileFilter, setProfileFilter] = useState<string>(selectedAccountId);
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredAndSorted = publishedPosts
    .filter((post) => {
      if (typeFilter !== "all" && post.type !== typeFilter) return false;
      if (profileFilter !== "all" && post.accountId !== profileFilter) return false;
      if (searchTerm && !post.caption.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const valA = (a[sortField] as number) || 0;
      const valB = (b[sortField] as number) || 0;
      return sortOrder === "desc" ? valB - valA : valA - valB;
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Analytics por Conteúdo
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Matriz analítica com ordenação por qualquer métrica: alcance, retenção, compartilhamentos e conversão de seguidores.
        </p>
      </div>

      {/* Barra de Filtros e Ordenação Rápida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por legenda..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Todos os tipos</option>
            <option value="reel">Reels</option>
            <option value="carousel">Carrosséis</option>
          </select>

          {/* Filtro Perfil */}
          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Todos os perfis</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                @{acc.username}
              </option>
            ))}
          </select>

          {/* Atalhos de Ordenação Rápida */}
          <select
            value={sortField}
            onChange={(e) => {
              setSortField(e.target.value as SortField);
              setSortOrder("desc");
            }}
            className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none"
          >
            <option value="views">Mais views</option>
            <option value="reach">Mais alcance</option>
            <option value="followersGained">Mais seguidores</option>
            <option value="shares">Mais compartilhamentos</option>
            <option value="saves">Mais salvamentos</option>
          </select>
        </div>
      </div>

      {/* Tabela Completa */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold select-none">
              <tr>
                <th className="px-4 py-3.5">Mídia & Perfil</th>
                <th className="px-3 py-3.5">Tipo</th>
                <th className="px-3 py-3.5">Data</th>
                <th
                  onClick={() => handleSort("views")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Views</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("reach")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Reach</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("likes")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Likes</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("comments")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Comments</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("shares")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Shares</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("saves")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Saves</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("profileVisits")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Visitas</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("followersGained")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900 font-bold text-emerald-700"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Followers</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("avgWatchTimeSeconds")}
                  className="px-3 py-3.5 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Avg Watch</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                        <Eye className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Nenhuma publicação encontrada
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Assim que seus Reels e carrosséis forem publicados, as métricas consolidadas de visualizações, alcance e retenção aparecerão aqui.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <Image
                          src={post.thumbnailUrl}
                          alt={post.caption}
                          width={40}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="truncate max-w-[160px]">
                        <span className="font-bold text-indigo-600 block truncate">
                          @{post.accountUsername}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate block">
                          {post.caption}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 uppercase font-bold text-[10px] text-slate-500">
                    {post.type}
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap text-slate-500 font-normal">
                    {formatDate(post.publishedAt)}
                  </td>

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

                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {formatNumber(post.profileVisits)}
                  </td>

                  <td className="px-3 py-3.5 text-right font-bold text-emerald-600">
                    +{post.followersGained}
                  </td>

                  <td className="px-3 py-3.5 text-right text-slate-700">
                    {post.avgWatchTimeSeconds ? `${post.avgWatchTimeSeconds}s` : "-"}
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
