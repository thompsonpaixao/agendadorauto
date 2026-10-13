import React from "react";
import { Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Marca */}
        <div className="flex items-center gap-2.5">
          <BrandLogo theme="light-text" size="xl" />
          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wider">
            Reels
          </span>
        </div>

        {/* Badges de Status */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Vercel Ready</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline">Meta API:</span>
            <span>Modo Mock</span>
          </div>
        </div>
      </div>
    </header>
  );
}
