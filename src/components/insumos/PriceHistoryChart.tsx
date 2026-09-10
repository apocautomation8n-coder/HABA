"use client";

import React, { useState, useMemo } from "react";
import { PriceRecord } from "@/types/insumo";

interface PriceHistoryChartProps {
  history: PriceRecord[];
  unit: string;
}

export function PriceHistoryChart({ history, unit }: PriceHistoryChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Ordenar cronológicamente (de más antiguo a más reciente para el gráfico)
  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [history]);

  // Dimensiones del SVG
  const width = 500;
  const height = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Cálculos de mínimos y máximos
  const { minPrice, maxPrice, points } = useMemo(() => {
    if (sortedHistory.length === 0) {
      return { minPrice: 0, maxPrice: 0, points: [] };
    }

    const prices = sortedHistory.map((item) => item.price);
    let min = Math.min(...prices);
    let max = Math.max(...prices);

    // Si todos los precios son iguales, damos un margen arriba y abajo
    if (min === max) {
      min = Math.max(0, min * 0.85);
      max = max * 1.15;
    } else {
      const margin = (max - min) * 0.15;
      min = Math.max(0, min - margin);
      max = max + margin;
    }

    const pts = sortedHistory.map((item, index) => {
      const x =
        sortedHistory.length === 1
          ? padding.left + chartWidth / 2
          : padding.left + (index / (sortedHistory.length - 1)) * chartWidth;
      const y =
        padding.top +
        chartHeight -
        ((item.price - min) / (max - min)) * chartHeight;

      // Variación porcentual respecto al punto anterior
      let variationPct: number | null = null;
      if (index > 0) {
        const prevPrice = sortedHistory[index - 1].price;
        variationPct = Math.round(((item.price - prevPrice) / prevPrice) * 100);
      }

      return {
        x,
        y,
        record: item,
        variationPct,
      };
    });

    return { minPrice: min, maxPrice: max, points: pts };
  }, [sortedHistory, chartWidth, chartHeight, padding.left, padding.top]);

  // Generar curva suave (Catmull-Rom o Bézier cúbico)
  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i !== points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [points]);

  // Área con relleno sombreado bajo la curva
  const areaPath = useMemo(() => {
    if (points.length < 2) return "";
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [linePath, points, padding.top, chartHeight]);

  // Formateadores
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  // Líneas de referencia horizontales (Y grid)
  const yTicks = useMemo(() => {
    if (minPrice === maxPrice) return [];
    return [0, 0.5, 1].map((ratio) => {
      const val = minPrice + (maxPrice - minPrice) * ratio;
      const y = padding.top + chartHeight - ratio * chartHeight;
      return { val, y };
    });
  }, [minPrice, maxPrice, padding.top, chartHeight]);

  if (sortedHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[#f9faf7] rounded-3xl border border-dashed border-[#d5ded2] text-center">
        <span className="text-2xl mb-1">🌱</span>
        <p className="text-xs font-semibold text-neutral-600">
          Aún no hay precios registrados
        </p>
        <p className="text-[11px] text-neutral-400 mt-0.5">
          Agregá el primer precio para ver la evolución gráfica.
        </p>
      </div>
    );
  }

  const activePoint =
    activePointIndex !== null ? points[activePointIndex] : points[points.length - 1];

  return (
    <div className="w-full bg-[#fcfdfa] rounded-3xl p-3.5 sm:p-4 border border-[#e8efe5] shadow-xs flex flex-col space-y-3">
      {/* Tooltip superior destacado / Estado actual seleccionado */}
      <div className="flex items-center justify-between px-1.5">
        <div>
          <span className="text-[11px] font-medium text-neutral-400 block">
            {activePointIndex !== null
              ? `Registro del ${new Date(activePoint.record.date).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : "Último precio de reposición"}
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-bold text-[#1F7A4C]">
              {formatCurrency(activePoint.record.price)}
            </span>
            <span className="text-xs text-neutral-500 font-medium">
              / {unit}
            </span>
          </div>
        </div>

        {activePoint.variationPct !== null && (
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              activePoint.variationPct > 0
                ? "bg-rose-50 text-rose-600 border border-rose-100"
                : activePoint.variationPct < 0
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <span>
              {activePoint.variationPct > 0
                ? `+${activePoint.variationPct}%`
                : `${activePoint.variationPct}%`}
            </span>
            <span>{activePoint.variationPct > 0 ? "📈" : activePoint.variationPct < 0 ? "📉" : "—"}</span>
          </div>
        )}
      </div>

      {/* Gráfico SVG */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Gradiente relleno kawaii */}
            <linearGradient id="habaChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3BB578" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#73b57a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#a3d1a7" stopOpacity="0.0" />
            </linearGradient>

            {/* Sombra suave para la línea */}
            <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow
                dx="0"
                dy="3"
                stdDeviation="3"
                floodColor="#1F7A4C"
                floodOpacity="0.18"
              />
            </filter>
          </defs>

          {/* Líneas horizontales de guía (Y-grid) */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="#e2ebe0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10"
                fontWeight="500"
                fill="#8ca388"
              >
                {formatCurrency(tick.val)}
              </text>
            </g>
          ))}

          {/* Área sombreada */}
          {points.length > 1 && (
            <path
              d={areaPath}
              fill="url(#habaChartGradient)"
              className="transition-all duration-300 ease-out"
            />
          )}

          {/* Línea conectora */}
          {points.length > 1 ? (
            <path
              d={linePath}
              fill="none"
              stroke="#3BB578"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#shadow)"
              className="transition-all duration-300 ease-out"
            />
          ) : (
            // Si hay 1 solo punto, mostramos línea horizontal de referencia
            <line
              x1={padding.left}
              y1={points[0].y}
              x2={width - padding.right}
              y2={points[0].y}
              stroke="#a3d1a7"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}

          {/* Línea vertical indicadora del punto activo */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={padding.top}
              x2={activePoint.x}
              y2={padding.top + chartHeight}
              stroke="#73b57a"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.8"
            />
          )}

          {/* Puntos / Marcadores interactivos */}
          {points.map((pt, idx) => {
            const isActive =
              activePointIndex === idx ||
              (activePointIndex === null && idx === points.length - 1);

            return (
              <g
                key={pt.record.id || idx}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => setActivePointIndex(idx)}
                onMouseEnter={() => setActivePointIndex(idx)}
              >
                {/* Zona de click ampliada */}
                <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />

                {/* Anillo de brillo activo */}
                {isActive && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="9"
                    fill="#3BB578"
                    fillOpacity="0.2"
                    className="animate-pulse"
                  />
                )}

                {/* Punto exterior */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? "6" : "4.5"}
                  fill="#ffffff"
                  stroke="#3BB578"
                  strokeWidth={isActive ? "3" : "2"}
                  className="transition-all duration-150"
                />

                {/* Punto interior si está activo */}
                {isActive && (
                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="#3BB578" />
                )}

                {/* Etiqueta de fecha en el eje X */}
                <text
                  x={pt.x}
                  y={padding.top + chartHeight + 18}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isActive ? "700" : "500"}
                  fill={isActive ? "#1F7A4C" : "#8ca388"}
                >
                  {formatDateLabel(pt.record.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detalle del punto seleccionado (nota / proveedor) */}
      {activePoint.record.note && (
        <div className="bg-[#f0f6ee] rounded-2xl px-3 py-2 text-[11px] text-[#1F7A4C] flex items-center gap-1.5 border border-[#dbe8d8]">
          <span>💬</span>
          <span className="font-medium">{activePoint.record.note}</span>
        </div>
      )}

      {points.length === 1 && (
        <p className="text-[11px] text-center text-neutral-400 italic">
          Tip: Al registrar nuevos precios de reposición, verás reflejada la curva de inflación/variación.
        </p>
      )}
    </div>
  );
}
