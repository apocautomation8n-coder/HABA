"use client";

import React from "react";
import { Layers } from "lucide-react";
import { formatCurrency } from "@/lib/units";

export interface ProductYieldCardProps {
  yieldValue: number | string;
  onChangeYield: (val: number | string) => void;
  batchMaterialsCost: number; // Costo total del lote de materiales (insumos + subproductos)
  suppliesCost: number; // Desglose: Insumos
  componentsCost: number; // Desglose: Subproductos
  unitDirectCost: number; // Costo unitario resultante de materiales
  batchLaborCost?: number; // Opcional: costo de mano de obra del lote (en edición)
  unitTotalCost?: number; // Opcional: costo unitario total (materiales + mano de obra)
  className?: string;
}

export function ProductYieldCard({
  yieldValue,
  onChangeYield,
  batchMaterialsCost,
  suppliesCost,
  componentsCost,
  unitDirectCost,
  batchLaborCost,
  unitTotalCost,
  className = "",
}: ProductYieldCardProps) {
  const numYield = typeof yieldValue === "number" ? yieldValue : parseFloat(String(yieldValue)) || 1;
  const safeYield = numYield > 0 ? numYield : 1;

  // Si hay mano de obra incluida, reflejarla en el desglose y totales
  const hasLabor = batchLaborCost !== undefined && batchLaborCost > 0;
  const displayBatchCost = hasLabor ? batchMaterialsCost + batchLaborCost : batchMaterialsCost;
  const displayUnitCost = hasLabor && unitTotalCost !== undefined ? unitTotalCost : unitDirectCost;

  const handleDecrease = () => {
    const nextVal = Math.max(1, safeYield - 1);
    onChangeYield(nextVal);
  };

  const handleIncrease = () => {
    const nextVal = safeYield + 1;
    onChangeYield(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChangeYield("");
      return;
    }
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      onChangeYield("");
    } else {
      onChangeYield(parsed);
    }
  };

  const handleBlur = () => {
    if (yieldValue === "" || Number(yieldValue) < 1) {
      onChangeYield(1);
    }
  };

  return (
    <div
      className={`p-4 bg-neutral-50/90 rounded-2xl border border-neutral-200/90 space-y-3.5 shadow-2xs ${className}`}
    >
      {/* Encabezado + Controles del Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#3BB578]" />
            <span>Rendimiento de la Receta / Lote</span>
          </label>
          <p className="text-[11px] text-neutral-500">
            ¿Cuántas unidades producís con esta receta de materiales? (Ej: 10 unidades)
          </p>
        </div>

        {/* Selector interactivo [-] [ input ] [+] */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0">
          <button
            type="button"
            onClick={handleDecrease}
            disabled={safeYield <= 1}
            className="w-8 h-8 bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 flex items-center justify-center transition shadow-2xs cursor-pointer disabled:cursor-not-allowed select-none active:scale-95"
            title="Disminuir rendimiento"
          >
            -
          </button>
          <div className="flex items-center bg-white px-2.5 py-1 rounded-xl border border-neutral-200 focus-within:border-[#3BB578] focus-within:ring-2 focus-within:ring-[#3BB578]/10 transition shadow-2xs">
            <input
              type="number"
              min="1"
              step="any"
              value={yieldValue === 0 ? "" : yieldValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="1"
              className="w-14 text-center text-xs font-black text-[#1F7A4C] outline-none bg-transparent"
            />
            <span className="text-[11px] font-bold text-neutral-400 ml-1">unidades</span>
          </div>
          <button
            type="button"
            onClick={handleIncrease}
            className="w-8 h-8 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 flex items-center justify-center transition shadow-2xs cursor-pointer select-none active:scale-95"
            title="Aumentar rendimiento"
          >
            +
          </button>
        </div>
      </div>

      {/* Resumen de Costos Integrado dentro de la misma tarjeta */}
      <div className="p-3 bg-white rounded-xl border border-neutral-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-[11px] font-bold text-neutral-700 block">
              Costo Total del Lote {hasLabor ? "(Producción)" : "(Materiales)"}:
            </span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Insumos: <strong className="text-neutral-600">{formatCurrency(suppliesCost)}</strong>
              {" | "}
              Subproductos: <strong className="text-neutral-600">{formatCurrency(componentsCost)}</strong>
              {hasLabor && (
                <>
                  {" | "}
                  M.O: <strong className="text-neutral-600">{formatCurrency(batchLaborCost!)}</strong>
                </>
              )}
            </span>
          </div>
          <span className="text-sm font-black text-neutral-800">
            {formatCurrency(displayBatchCost)}
          </span>
        </div>

        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-[#1F7A4C]">
            Costo Unitario Resultante ({safeYield} {safeYield === 1 ? "unidad" : "unidades"}):
          </span>
          <span className="text-sm font-black text-[#1F7A4C] bg-[#DCF4D7] px-2.5 py-0.5 rounded-lg border border-[#3BB578]/30 shadow-2xs">
            {formatCurrency(displayUnitCost)} / u
          </span>
        </div>
      </div>
    </div>
  );
}
