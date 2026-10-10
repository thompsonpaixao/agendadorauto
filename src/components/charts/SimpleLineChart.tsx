"use client";

import React, { useState } from "react";

interface DataPoint {
  label: string;
  value: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function SimpleLineChart({
  data,
  height = 200,
  color = "#4f46e5",
  valuePrefix = "",
  valueSuffix = "",
}: SimpleLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const paddingX = 30;
  const paddingY = 20;
  const chartWidth = 500;
  const chartHeight = height;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * (chartWidth - 2 * paddingX);
    const y = chartHeight - paddingY - (d.value / maxValue) * (chartHeight - 2 * paddingY);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, point, index) => {
    return index === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Linhas de grade horizontais */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = chartHeight - paddingY - ratio * (chartHeight - 2 * paddingY);
          return (
            <line
              key={i}
              x1={paddingX}
              y1={y}
              x2={chartWidth - paddingX}
              y2={y}
              stroke="#f1f5f9"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {/* Área sombreada */}
        <path d={areaD} fill={`url(#gradient-${color.replace("#", "")})`} />

        {/* Linha principal */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos de dados */}
        {points.map((p, index) => {
          const isHovered = hoveredIndex === index;
          return (
            <g
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 3.5}
                fill="#ffffff"
                stroke={color}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-150"
              />
            </g>
          );
        })}
      </svg>

      {/* Rótulos no eixo X */}
      <div className="flex justify-between px-2 pt-2 text-[10px] sm:text-xs text-slate-500 font-medium">
        {data.map((d, index) => (
          <span key={index}>{d.label}</span>
        ))}
      </div>

      {/* Tooltip interativo */}
      {hoveredIndex !== null && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none transition-all"
        >
          <span className="text-slate-400 font-medium mr-1.5">
            {data[hoveredIndex].label}:
          </span>
          <span className="font-bold">
            {valuePrefix}
            {new Intl.NumberFormat("pt-BR").format(data[hoveredIndex].value)}
            {valueSuffix}
          </span>
        </div>
      )}
    </div>
  );
}
