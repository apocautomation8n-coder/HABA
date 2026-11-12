"use client";

import React from "react";
import { Clock, RefreshCw, ArrowRight, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { useFormatPrefs } from "@/hooks/useFormatPrefs";

export interface LaborRateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  affectedCount: number;
  newMinuteRate: number;
  onRecalculateAll: () => Promise<void>;
  isRecalculatingAll?: boolean;
  onGoToProducts: () => void;
}

export const LaborRateChangeModal: React.FC<LaborRateChangeModalProps> = ({
  isOpen,
  onClose,
  affectedCount,
  newMinuteRate,
  onRecalculateAll,
  isRecalculatingAll = false,
  onGoToProducts,
}) => {
  const { formatMoney } = useFormatPrefs();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden border border-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-[#1F7A4C]">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                Valor del minuto actualizado
              </h3>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                Nueva tarifa: <strong className="text-[#1F7A4C]">{formatMoney(newMinuteRate)} / min</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/80 rounded-xl transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 sm:p-6 space-y-4 text-xs text-neutral-700">
          {/* Mensaje de aviso */}
          <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200/80 text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <strong className="text-xs font-bold">
                Impacto detectado en tus productos
              </strong>
            </div>
            <p className="text-xs leading-relaxed text-amber-800">
              Modificaste el valor del minuto. Se marcaron{" "}
              <strong>
                {affectedCount} {affectedCount === 1 ? "producto" : "productos"}
              </strong>{" "}
              con alerta de actualización de costos porque tienen tiempo de producción cargado y su costo de mano de obra varió.
            </p>
          </div>

          <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 space-y-2 text-neutral-600">
            <p className="text-xs font-semibold text-neutral-800">
              ¿Cómo deseás proceder?
            </p>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Podés actualizar en lote todos los productos automáticamente manteniendo tus márgenes de ganancia en cada canal, o ir a la sección de productos para revisarlos uno por uno.
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRecalculateAll}
            disabled={isRecalculatingAll}
            className="w-full py-3 px-4 bg-[#1F7A4C] hover:bg-[#165837] active:scale-95 text-white rounded-2xl text-xs sm:text-sm font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRecalculatingAll ? "animate-spin" : ""}`} />
            <span>
              {isRecalculatingAll
                ? "Recalculando todos los productos..."
                : "Recalcular costos de todos mis productos automáticamente"}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToProducts}
              disabled={isRecalculatingAll}
              className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-300 hover:bg-neutral-200/60 active:scale-95 text-neutral-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>Revisar productos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isRecalculatingAll}
              className="py-2.5 px-4 rounded-xl hover:bg-neutral-200/50 text-neutral-500 hover:text-neutral-700 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              Dejar para después
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

