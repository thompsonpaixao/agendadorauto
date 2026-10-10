"use client";

import React, { useState } from "react";

interface BarDataPoint {
  label: string;
  value1: number; // Ex: Sucesso
  value2?: number; // Ex: Erros
}

interface SimpleBarChartProps {
  data: BarDataPoint[];
  height?: number;
  label1?: string;
  label2?: string;
  color1?: string;
  color2?: string;
}

export function SimpleBarChart({
  data,
  height = 200,
  label1 = "Sucesso",
  label2 = "Erros",
  color1 = "#10b981", // emerald
  color2 = "#f43f5e", // rose
}: SimpleBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.value1, d.value2 || 0)),
    1
  );

  const chartWidth = 500;
  const chartHeight = height;
  const paddingX = 30;
  const paddingY = 20;

  const availableWidth = chartWidth - 2 * paddingX;
  const slotWidth = availableWidth / data.length;
  const barWidth = data[0].value2 !== undefined ? slotWidth * 0.35 : slotWidth * 0.6;

  return (
    <div className="w-full relative select-none">
      {/* Legenda do gráfico */}
      <div className="flex items-center justify-end gap-4 mb-2 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color1 }} />
          <span>{label1}</span>
        </div>
        {data[0].value2 !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color2 }} />
            <span>{label2}</span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
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

        {/* Barras */}
        {data.map((d, index) => {
          const slotX = paddingX + index * slotWidth;
          const height1 = (d.value1 / maxVal) * (chartHeight - 2 * paddingY);
          const y1 = chartHeight - paddingY - height1;

          const hasSecond = d.value2 !== undefined;
          const height2 = hasSecond ? ((d.value2 || 0) / maxVal) * (chartHeight - 2 * paddingY) : 0;
          const y2 = chartHeight - paddingY - height2;

          const isHovered = hoveredIndex === index;

          return (
            <g
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Barra 1 */}
              <rect
                x={hasSecond ? slotX + slotWidth * 0.12 : slotX + slotWidth * 0.2}
                y={y1}
                width={barWidth}
                height={Math.max(height1, 2)}
                rx={4}
                fill={color1}
                opacity={isHovered ? 1 : 0.85}
                className="transition-all duration-150"
              />

              {/* Barra 2 (se existir) */}
              {hasSecond && (
                <rect
                  x={slotX + slotWidth * 0.12 + barWidth + 4}
                  y={y2}
                  width={barWidth}
                  height={Math.max(height2, 2)}
                  rx={4}
                  fill={color2}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-all duration-150"
                />
              )}
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none transition-all flex items-center gap-3">
          <span className="text-slate-400 font-semibold">{data[hoveredIndex].label}</span>
          <span className="text-emerald-400 font-bold">
            {label1}: {data[hoveredIndex].value1}
          </span>
          {data[hoveredIndex].value2 !== undefined && (
            <span className="text-rose-400 font-bold">
              {label2}: {data[hoveredIndex].value2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
