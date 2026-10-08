"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, ExternalLink, Layers } from "lucide-react";
import Image from "next/image";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";

export default function CarrosseisPublicadosPage() {
  const { publishedPosts, selectedAccountId, accounts } = useAppState();

  const [searchTerm, setSearchTerm] = useState("");
  const [profileFilter, setProfileFilter] = useState<string>(selectedAccountId);

  const carouselsOnly = publishedPosts.filter((p) => p.type === "carousel");

  const filtered = carouselsOnly.filter((post) => {
    const matches =
      post.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.accountUsername.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matches) return false;
    if (profileFilter !== "all" && post.accountId !== profileFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Carrosséis Publicados
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Métricas de alcance, engajamento e retenção de postagens com múltiplos slides.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-3.5">Mídia & Perfil</th>
              <th className="px-4 py-3.5">Legenda</th>
              <th className="px-4 py-3.5">Data / Hora</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-3 py-3.5 text-right">Views</th>
              <th className="px-3 py-3.5 text-right">Likes</th>
              <th className="px-3 py-3.5 text-right">Saves</th>
              <th className="px-4 py-3.5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-3">
                      <Layers className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      Nenhum carrossel publicado ainda
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Assim que um carrossel agendado for publicado no perfil, os slides e as métricas aparecerão aqui.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((post) => (
              <tr key={post.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <Image
                        src={post.thumbnailUrl}
                        alt={post.caption}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div>
                      <span className="font-bold text-indigo-600 block">
                        @{post.accountUsername}
                      </span>
                      <span className="text-[10px] text-slate-400">Carrossel</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 max-w-sm truncate text-slate-700">
                  {post.caption}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-normal">
                  {formatDate(post.publishedAt)} às {formatTime(post.publishedAt)}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status="published" />
                </td>
                <td className="px-3 py-3.5 text-right font-bold text-slate-900">
                  {formatNumber(post.views)}
                </td>
                <td className="px-3 py-3.5 text-right text-slate-700">
                  {formatNumber(post.likes)}
                </td>
                <td className="px-3 py-3.5 text-right text-slate-700">
                  {formatNumber(post.saves)}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <button type="button" className="p-1.5 text-slate-400 hover:text-slate-700">
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
  );
}
