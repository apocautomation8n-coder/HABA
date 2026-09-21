"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  Package,
  DollarSign,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  X,
  AlertCircle,
  Clock,
  EyeOff,
} from "lucide-react";

interface OnboardingGuideProps {
  hasSupplies: boolean;
  hasExpensesOrLabor: boolean;
  hasProducts: boolean;
  loading?: boolean;
}

export function OnboardingGuide({
  hasSupplies,
  hasExpensesOrLabor,
  hasProducts,
  loading = false,
}: OnboardingGuideProps) {
  const [isDismissed, setIsDismissed] = useState<boolean>(true); // Inicializado en true para evitar flash antes de leer localStorage
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem("haba_hide_onboarding_guide");
    if (dismissed === "true") {
      setIsDismissed(true);
    } else {
      setIsDismissed(false);
    }
  }, []);

  // Calcular cantidad de pasos completados
  const completedCount =
    (hasSupplies ? 1 : 0) +
    (hasExpensesOrLabor ? 1 : 0) +
    (hasProducts ? 1 : 0);

  const allCompleted = completedCount === 3;

  // Si no está montado o el usuario eligió ocultar la guía, no renderizar
  if (!mounted || isDismissed) {
    return null;
  }

  // Si la cuenta ya tiene todos los pasos completos, se oculta automáticamente para no restar espacio útil
  if (allCompleted) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem("haba_hide_onboarding_guide", "true");
    setIsDismissed(true);
  };

  const progressPercentage = Math.round((completedCount / 3) * 100);

  return (
    <div className="bg-white rounded-3xl p-5 border border-[#EAF0E8] shadow-xs space-y-4 font-body animate-in fade-in duration-300">
      {/* Header con título, progreso y botón de cerrar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold bg-[#DCF4D7] text-[#1F7A4C] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Guía Inicial
              </span>
              <span className="text-xs font-semibold text-[#7A7A7A]">
                Paso {completedCount} de 3 completado{completedCount === 1 ? "" : "s"}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-[#2B2B2B] font-display mt-0.5">
              Comenzá acá: Poné a punto tus costos en 3 pasos
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xl transition flex-shrink-0"
          title="Ocultar guía inicial"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-[#F6F7F2] h-2 rounded-full overflow-hidden border border-[#EAF0E8]">
        <div
          className="bg-gradient-to-r from-[#3BB578] to-[#2E9E65] h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Lista de los 3 Pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Paso 1: Insumos y Materias Primas */}
        <div
          className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
            hasSupplies
              ? "bg-[#F9FCF8] border-[#C3EBC0]"
              : "bg-white border-[#EAF0E8] hover:border-[#3BB578]/50"
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    hasSupplies
                      ? "bg-[#DCF4D7] text-[#1F7A4C]"
                      : "bg-[#E4F5E2] text-[#3BB578]"
                  }`}
                >
                  {hasSupplies ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-[#2B2B2B]">
                  Paso 1: Insumos
                </span>
              </div>

              {hasSupplies ? (
                <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Hecho
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Prioridad
                </span>
              )}
            </div>

            <p className="text-xs text-[#7A7A7A] leading-relaxed">
              Cargá los materiales que usás para fabricar (papel, telas, packaging, etc.) y su precio de reposición.
            </p>
          </div>

          <Link
            href="/insumos"
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 ${
              hasSupplies
                ? "bg-neutral-100 hover:bg-neutral-200 text-[#2B2B2B]"
                : "bg-[#3BB578] hover:bg-[#2E9E65] text-white shadow-xs"
            }`}
          >
            <span>{hasSupplies ? "Ver Insumos" : "Cargar Insumos"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Paso 2: Gastos Fijos y Costo por Minuto */}
        <div
          className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
            hasExpensesOrLabor
              ? "bg-[#F9FCF8] border-[#C3EBC0]"
              : "bg-white border-[#EAF0E8] hover:border-[#3BB578]/50"
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    hasExpensesOrLabor
                      ? "bg-[#DCF4D7] text-[#1F7A4C]"
                      : "bg-[#EBDDF9] text-purple-600"
                  }`}
                >
                  {hasExpensesOrLabor ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <DollarSign className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-[#2B2B2B]">
                  Paso 2: Gastos Fijos
                </span>
              </div>

              {hasExpensesOrLabor ? (
                <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Hecho
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                  Esencial
                </span>
              )}
            </div>

            <p className="text-xs text-[#7A7A7A] leading-relaxed">
              Definí tus costos fijos mensuales (alquiler, servicios, herramientas) y el valor de tu hora de trabajo.
            </p>
          </div>

          <Link
            href="/gastos"
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 ${
              hasExpensesOrLabor
                ? "bg-neutral-100 hover:bg-neutral-200 text-[#2B2B2B]"
                : "bg-[#3BB578] hover:bg-[#2E9E65] text-white shadow-xs"
            }`}
          >
            <span>{hasExpensesOrLabor ? "Ver Gastos Fijos" : "Definir Gastos"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Paso 3: Crear tu Primer Producto */}
        <div
          className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
            hasProducts
              ? "bg-[#F9FCF8] border-[#C3EBC0]"
              : "bg-white border-[#EAF0E8] hover:border-[#3BB578]/50"
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    hasProducts
                      ? "bg-[#DCF4D7] text-[#1F7A4C]"
                      : "bg-[#FFE3E3] text-rose-600"
                  }`}
                >
                  {hasProducts ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <ShoppingBag className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-[#2B2B2B]">
                  Paso 3: Primer Producto
                </span>
              </div>

              {hasProducts ? (
                <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Hecho
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                  Paso Final
                </span>
              )}
            </div>

            <p className="text-xs text-[#7A7A7A] leading-relaxed">
              Armá tu producto combinando tus insumos y calculá tu margen de ganancia real.
            </p>

            {/* Sugerencia suave si faltan los pasos 1 y 2 */}
            {!hasSupplies && !hasProducts && (
              <div className="p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-start gap-1.5 text-[10.5px] text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 mt-0.5" />
                <span>Te recomendamos completar los pasos 1 y 2 primero.</span>
              </div>
            )}
          </div>

          <Link
            href="/productos"
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 ${
              hasProducts
                ? "bg-neutral-100 hover:bg-neutral-200 text-[#2B2B2B]"
                : hasSupplies
                ? "bg-[#3BB578] hover:bg-[#2E9E65] text-white shadow-xs"
                : "bg-neutral-100 hover:bg-neutral-200 text-[#2B2B2B]"
            }`}
          >
            <span>{hasProducts ? "Ver Productos" : "Crear Producto"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Footer con opción de descartar guía */}
      <div className="pt-1 flex items-center justify-between text-[11px] text-[#7A7A7A] border-t border-neutral-100">
        <span>Podés consultar esta guía cuando quieras.</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-neutral-400 hover:text-neutral-600 underline flex items-center gap-1 transition"
        >
          <EyeOff className="w-3 h-3" />
          Ocultar guía
        </button>
      </div>
    </div>
  );
}
