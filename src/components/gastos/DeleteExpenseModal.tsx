"use client";

import React, { useState } from "react";
import { X, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";
import { FixedExpense } from "./ExpenseModal";

interface DeleteExpenseModalProps {
  isOpen: boolean;
  expense: FixedExpense | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export const DeleteExpenseModal: React.FC<DeleteExpenseModalProps> = ({
  isOpen,
  expense,
  onClose,
  onSuccess,
}) => {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const handleConfirmDelete = async () => {
    if (!expense.id) return;
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from("fixed_expenses")
        .delete()
        .eq("id", expense.id);

      if (deleteError) throw deleteError;

      onSuccess(expense.id);
      onClose();
    } catch (err: any) {
      console.error("Error al eliminar gasto fijo:", err);
      setError(err.message || "No se pudo eliminar el gasto. Intentalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-[#EAF0E8] p-5 sm:p-6 relative animate-in zoom-in-95 duration-200">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition disabled:opacity-40"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col text-center space-y-3 pt-1">
          {/* Icono */}
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
            <Trash2 className="w-6 h-6" />
          </div>

          <div>
            <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 inline-block mb-1.5">
              Confirmar eliminación
            </span>
            <h3 className="text-sm sm:text-base font-bold text-neutral-800">
              ¿Eliminar &ldquo;{expense.name}&rdquo;?
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Se quitará de tu estructura de costos fijos mensuales.
            </p>
          </div>

          {/* Tarjeta detalle */}
          <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3 text-left flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-700 block truncate max-w-[170px]">
                {expense.name}
              </span>
              <span className="text-[10px] text-neutral-400 capitalize">
                {expense.periodicity} ({formatCurrency(expense.amount)})
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-[#1F7A4C] font-bold uppercase block">
                Impacto mensual
              </span>
              <span className="text-xs font-black text-[#1F7A4C]">
                -{formatCurrency(expense.monthly_equivalent)}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-700 text-xs text-left flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-2.5 text-[11px] text-neutral-500">
            Esta acción es definitiva y no se puede deshacer.
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.99] rounded-2xl transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.99] rounded-2xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, eliminar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
