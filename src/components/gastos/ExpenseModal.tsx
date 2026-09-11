"use client";

import React, { useEffect, useState, useMemo } from "react";
import { X, Sparkles, AlertCircle, Loader2, DollarSign, Calendar, Calculator } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";

export interface FixedExpense {
  id?: string;
  name: string;
  amount: number;
  periodicity: "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";
  monthly_equivalent: number;
  created_at?: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (expense: FixedExpense, isEdit: boolean) => void;
  initialExpense?: FixedExpense | null;
}

const QUICK_SUGGESTIONS = [
  "Alquiler taller",
  "Luz / Electricidad",
  "Gas / Agua",
  "Internet / Wifi",
  "Canva Pro / Apps",
  "Monotributo",
  "Publicidad redes",
  "Mantenimiento",
];

const PERIODICITY_DIVIDERS: Record<FixedExpense["periodicity"], number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialExpense,
}) => {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [periodicity, setPeriodicity] = useState<FixedExpense["periodicity"]>("mensual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialExpense?.id);

  useEffect(() => {
    if (initialExpense) {
      setName(initialExpense.name || "");
      setAmount(initialExpense.amount || "");
      setPeriodicity(initialExpense.periodicity || "mensual");
      setError(null);
    } else {
      setName("");
      setAmount("");
      setPeriodicity("mensual");
      setError(null);
    }
  }, [initialExpense, isOpen]);

  // Cálculo en vivo del equivalente mensual
  const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  const monthlyEquivalent = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    const divider = PERIODICITY_DIVIDERS[periodicity] || 1;
    return parsedAmount / divider;
  }, [parsedAmount, periodicity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Por favor, ingresá un nombre para el gasto fijo.");
      return;
    }

    if (parsedAmount <= 0) {
      setError("El monto debe ser mayor a $0.");
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No hay una sesión de usuaria activa.");
      }

      if (isEditing && initialExpense?.id) {
        // Modo Edición
        const { data, error: updateError } = await supabase
          .from("fixed_expenses")
          .update({
            name: cleanName,
            amount: parsedAmount,
            periodicity,
            monthly_equivalent: monthlyEquivalent,
          })
          .eq("id", initialExpense.id)
          .select()
          .single();

        if (updateError) throw updateError;
        onSuccess(data as FixedExpense, true);
      } else {
        // Modo Creación
        const { data, error: insertError } = await supabase
          .from("fixed_expenses")
          .insert({
            user_id: user.id,
            name: cleanName,
            amount: parsedAmount,
            periodicity,
            monthly_equivalent: monthlyEquivalent,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        onSuccess(data as FixedExpense, false);
      }

      onClose();
    } catch (err: any) {
      console.error("Error al guardar gasto fijo:", err);
      setError(err.message || "No se pudo guardar el gasto. Intentalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#EAF0E8] relative animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-800">
                {isEditing ? "Editar Gasto Fijo" : "Nuevo Gasto Fijo"}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {isEditing
                  ? "Modificá el valor o la frecuencia de pago"
                  : "Registrá un costo recurrente de tu taller o negocio"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">
              Nombre del Gasto
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Alquiler, Luz, Canva Pro, Internet..."
              required
              className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
            />

            {/* Chips sugeridos */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-neutral-400">Sugerencias:</span>
              {QUICK_SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setName(item)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                    name.toLowerCase() === item.toLowerCase()
                      ? "bg-[#DCF4D7] text-[#1F7A4C] border-[#C3EBC0] font-bold"
                      : "bg-white text-neutral-500 border-neutral-200 hover:border-[#3BB578] hover:text-[#1F7A4C]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Monto y Periodicidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Monto */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 block">
                Monto a Pagar ($)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400 font-bold text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-3 py-2.5 text-xs font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
                />
              </div>
            </div>

            {/* Periodicidad */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 block">
                Frecuencia de Pago
              </label>
              <select
                value={periodicity}
                onChange={(e) => setPeriodicity(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition cursor-pointer"
              >
                <option value="mensual">Mensual (1 mes)</option>
                <option value="bimestral">Bimestral (cada 2 meses)</option>
                <option value="trimestral">Trimestral (cada 3 meses)</option>
                <option value="semestral">Semestral (cada 6 meses)</option>
                <option value="anual">Anual (cada 12 meses)</option>
              </select>
            </div>
          </div>

          {/* Card Preview: Cálculo en vivo de impacto mensual */}
          <div className="bg-[#DCF4D7]/70 border border-[#C3EBC0] rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#3BB578] text-white flex items-center justify-center flex-shrink-0">
                <Calculator className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#1F7A4C] uppercase tracking-wide block">
                  Impacto en tus recetas
                </span>
                <span className="text-[11px] text-neutral-600">
                  {periodicity === "mensual"
                    ? "Gasto mensual directo"
                    : `Normalizado a 1 mes (÷ ${PERIODICITY_DIVIDERS[periodicity]})`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs sm:text-sm font-black text-[#1F7A4C]">
                {formatCurrency(monthlyEquivalent)}
              </span>
              <span className="text-[9px] text-neutral-500 block">/ mes</span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.99] rounded-2xl transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] rounded-2xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Guardar Cambios" : "Agregar Gasto"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
