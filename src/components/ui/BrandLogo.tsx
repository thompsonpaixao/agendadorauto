import React from "react";
import Link from "next/link";

export interface BrandLogoProps {
  /**
   * Tamanho do texto da marca.
   * xs: 12px, sm: 14px, md: 16-18px, lg: 20-22px, xl: 24-28px, 2xl: 30-36px
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * Tema para fundos claros (dark-text) ou fundos escuros (light-text).
   * dark-text: "Agendador" em text-slate-900 e "Auto" em text-indigo-600.
   * light-text: "Agendador" em text-white e "Auto" em text-indigo-400.
   */
  theme?: "dark-text" | "light-text";
  /**
   * Modo compacto para visualização recolhida (ex: sidebar colapsada).
   * Exibe "A" (cor principal) + "A" (destaque).
   */
  collapsed?: boolean;
  /**
   * Classes extras customizadas.
   */
  className?: string;
  /**
   * Se informado, envolve a marca em um Link do Next.js.
   */
  href?: string;
}

const sizeClasses = {
  xs: "text-xs tracking-tight",
  sm: "text-sm tracking-tight",
  md: "text-base sm:text-lg tracking-tight",
  lg: "text-xl sm:text-2xl tracking-tight",
  xl: "text-2xl sm:text-3xl tracking-tight",
  "2xl": "text-3xl sm:text-4xl tracking-tight",
};

export function BrandLogo({
  size = "md",
  theme = "dark-text",
  collapsed = false,
  className = "",
  href,
}: BrandLogoProps) {
  const isLightText = theme === "light-text";

  const mainColor = isLightText ? "text-white" : "text-slate-900";
  const highlightColor = isLightText ? "text-indigo-400" : "text-indigo-600";

  const logoMarkup = (
    <span
      className={`inline-flex items-baseline font-black select-none leading-none transition-colors ${sizeClasses[size]} ${className}`}
    >
      {collapsed ? (
        <>
          <span className={mainColor}>A</span>
          <span className={highlightColor}>A</span>
        </>
      ) : (
        <>
          <span className={mainColor}>Agendador</span>
          <span className={highlightColor}>Auto</span>
        </>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group focus:outline-none">
        {logoMarkup}
      </Link>
    );
  }

  return logoMarkup;
}
