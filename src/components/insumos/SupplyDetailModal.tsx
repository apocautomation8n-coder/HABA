"use client";

import React from "react";
import { X, Edit2, TrendingUp, Sparkles, Package, Layers, Calculator } from "lucide-react";
import { SupplyItem } from "@/components/SupplyModal";
import { formatCurrency, calculateUnitCost } from "@/lib/units";

interface SupplyDetailModalProps {
  isOpen: boolean;
  supply: SupplyItem | null;
  onClose: () => void;
  onEdit: (supply: SupplyItem) => void;
  onOpenHistory: (supply: SupplyItem) => void;
}

export const SupplyDetailModal: React.FC<SupplyDetailModalProps> = ({
  isOpen,
  supply,
  onClose,
  onEdit,
  onOpenHistory,
}) => {
  if (!isOpen || !supply) return null;

  const unitCost = calculateUnitCost(
    supply.current_price,
    supply.purchase_quantity,
    supply.conversion_factor
  );
  const totalUseUnits = (supply.purchase_quantity || 1) * (supply.conversion_factor || 1);

  return (
    <div
      className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-[#EAF0E8] animate-in slide-in-from-bottom-6 duration-200 overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                supply.category === "packaging"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-[#DCF4D7] text-[#3BB578]"
              }`}
            >
              {supply.category === "packaging" ? (
                <Package className="w-5 h-5" />
              ) : (
                <Layers className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-800 leading-snug truncate max-w-[240px]">
                {supply.name}
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  supply.category === "packaging"
                    ? "bg-amber-100/70 text-amber-800"
                    : "bg-[#DCF4D7] text-[#1F7A4C]"
                }`}
              >
                {supply.category === "packaging" ? "Packaging" : "Materia Prima"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Tarjetas de costo y reposición */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#DCF4D7]/70 p-3 rounded-2xl border border-[#C3EBC0]">
              <span className="text-[10px] font-bold text-[#1F7A4C] block">
                Costo por {supply.use_unit}
              </span>
              <span className="text-lg font-black text-[#1F7A4C]">
                {formatCurrency(unitCost)}
              </span>
              <span className="text-[9px] text-[#1F7A4C]/80 block mt-0.5">
                Usado en tus recetas
              </span>
            </div>

            <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-500 block">
                Precio de Reposición
              </span>
              <span className="text-lg font-black text-neutral-800">
                {formatCurrency(supply.current_price)}
              </span>
              <span className="text-[9px] text-neutral-400 block mt-0.5">
                Por bulto o compra
              </span>
            </div>
          </div>

          {/* Ficha técnica de la carga */}
          <div className="bg-[#F6F7F2] p-3.5 rounded-2xl border border-[#EAF0E8] space-y-2.5 text-xs">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
              Parámetros de la Carga:
            </span>
            <div className="flex justify-between py-1 border-b border-neutral-200/50">
              <span className="text-neutral-600">Cantidad Comprada:</span>
              <span className="font-bold text-neutral-800">
                {supply.purchase_quantity} {supply.purchase_unit}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200/50">
              <span className="text-neutral-600">Unidad de Uso (Recetas):</span>
              <span className="font-bold text-neutral-800">{supply.use_unit}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200/50">
              <span className="text-neutral-600">Factor de Rendimiento:</span>
              <span className="font-bold text-neutral-800">
                1 {supply.purchase_unit} = {supply.conversion_factor} {supply.use_unit}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-600">Rendimiento Total:</span>
              <span className="font-extrabold text-[#1F7A4C]">
                {totalUseUnits} {supply.use_unit}
              </span>
            </div>
          </div>

          {/* Explicación didáctica */}
          <div className="bg-[#F0FAF4] border border-[#DCF4D7] p-3 rounded-2xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#1F7A4C] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-snug text-[#2B2B2B]">
              Comprás <strong>{supply.purchase_quantity} {supply.purchase_unit}</strong> a{" "}
              <strong>{formatCurrency(supply.current_price)}</strong>. Te rinde{" "}
              <strong>
                {totalUseUnits} {supply.use_unit}
              </strong>
              , por lo que cada <strong>{supply.use_unit}</strong> te cuesta{" "}
              <strong>{formatCurrency(unitCost)}</strong>.
            </p>
          </div>
        </div>

        {/* Acciones inferiores */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <button
            onClick={() => {
              onClose();
              onEdit(supply);
            }}
            className="flex-1 py-3 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white font-bold text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
            <span>Editar este Insumo</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenHistory(supply);
            }}
            className="py-3 px-4 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-xs rounded-2xl border border-neutral-200 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Ver Historial</span>
          </button>
        </div>
      </div>
    </div>
  );
};
