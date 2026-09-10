"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Calendar, TrendingUp, DollarSign, Plus, ArrowUpDown, Tag, Sparkles } from "lucide-react";
import { Insumo, PriceRecord } from "@/types/insumo";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { HabaMascot } from "@/components/HabaMascot";

interface PriceHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  insumo: Insumo | null;
  onAddPriceRecord?: (insumoId: string, record: Omit<PriceRecord, "id">) => void;
}

export function PriceHistoryDrawer({
  isOpen,
  onClose,
  insumo,
  onAddPriceRecord,
}: PriceHistoryDrawerProps) {
  // Ordenamiento de la lista: true = descendente (recientes primero), false = ascendente (antiguos primero)
  const [isDescOrder, setIsDescOrder] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Campos de formulario para nuevo precio
  const [newPrice, setNewPrice] = useState<string>("");
  const [newDate, setNewDate] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Inicializar fecha por defecto al abrir
  useEffect(() => {
    if (isOpen) {
      setNewDate(new Date().toISOString().split("T")[0]);
      setShowAddForm(false);
      setNewPrice("");
      setNewNote("");
      setFormError(null);
    }
  }, [isOpen]);

  // Manejar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Bloquear scroll de fondo cuando el drawer está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Lista ordenada cronológicamente
  const chronologicalList = useMemo(() => {
    if (!insumo || !insumo.history) return [];

    // Siempre calculamos las diferencias cronológicamente de antiguo a reciente
    const sortedAsc = [...insumo.history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const withDiffs = sortedAsc.map((record, index) => {
      let diffAmount = 0;
      let diffPct = 0;
      if (index > 0) {
        const prev = sortedAsc[index - 1].price;
        diffAmount = record.price - prev;
        diffPct = prev > 0 ? Math.round(((record.price - prev) / prev) * 100) : 0;
      }
      return {
        ...record,
        diffAmount,
        diffPct,
        isLatest: index === sortedAsc.length - 1,
      };
    });

    // Invertir si el usuario prefiere los más recientes primero
    return isDescOrder ? [...withDiffs].reverse() : withDiffs;
  }, [insumo, isDescOrder]);

  // Métricas de variación histórica total
  const metrics = useMemo(() => {
    if (!insumo || !insumo.history || insumo.history.length === 0) {
      return { totalVariationPct: 0, minPrice: 0, maxPrice: 0, firstPrice: 0 };
    }

    const sortedAsc = [...insumo.history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const prices = sortedAsc.map((r) => r.price);
    const first = sortedAsc[0].price;
    const last = sortedAsc[sortedAsc.length - 1].price;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const totalVariationPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

    return {
      totalVariationPct,
      minPrice: min,
      maxPrice: max,
      firstPrice: first,
    };
  }, [insumo]);

  if (!insumo) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const num = parseFloat(newPrice);
    if (isNaN(num) || num <= 0) {
      setFormError("Ingresá un precio válido mayor a 0");
      return;
    }

    if (!newDate) {
      setFormError("Seleccioná la fecha del registro");
      return;
    }

    if (onAddPriceRecord) {
      onAddPriceRecord(insumo.id, {
        price: num,
        date: newDate,
        note: newNote.trim() || undefined,
      });
    }

    // Limpiar formulario y cerrar acordeón
    setNewPrice("");
    setNewNote("");
    setShowAddForm(false);
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop con desenfoque suave */}
      <div
        className="fixed inset-0 bg-neutral-900/35 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Panel lateral deslizante */}
      <div
        className={`fixed inset-y-0 right-0 max-w-full flex w-full sm:max-w-md bg-[#fbfaf6] shadow-2xl transition-transform duration-300 ease-out flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabecera del Drawer */}
        <div className="p-4 sm:p-5 border-b border-[#e9efe6] bg-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#e5f2e6] text-[#3b7c42] flex items-center justify-center font-bold text-lg">
              🌱
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-800 leading-tight">
                  {insumo.name}
                </h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#f0f6ee] text-[#306236] border border-[#dbe8d8]">
                  {insumo.category}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Historial cronológico de precios
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 flex items-center justify-center transition-colors active:scale-95"
            title="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Tarjetas de Métricas Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3.5 rounded-3xl border border-[#e8efe5] shadow-xs">
              <span className="text-[11px] font-medium text-neutral-400 block">
                Precio actual (reposición)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-extrabold text-[#2a4f2f]">
                  {formatCurrency(insumo.current_price)}
                </span>
                <span className="text-xs font-semibold text-neutral-500">
                  / {insumo.purchase_unit}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Usado para costeo de productos
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-3xl border border-[#e8efe5] shadow-xs">
              <span className="text-[11px] font-medium text-neutral-400 block">
                Variación histórica
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-xl font-extrabold ${
                    metrics.totalVariationPct > 0
                      ? "text-rose-600"
                      : metrics.totalVariationPct < 0
                      ? "text-emerald-600"
                      : "text-neutral-700"
                  }`}
                >
                  {metrics.totalVariationPct > 0
                    ? `+${metrics.totalVariationPct}%`
                    : `${metrics.totalVariationPct}%`}
                </span>
                <span className="text-xs">
                  {metrics.totalVariationPct > 0 ? "📈" : metrics.totalVariationPct < 0 ? "📉" : "—"}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Rango: {formatCurrency(metrics.minPrice)} - {formatCurrency(metrics.maxPrice)}
              </p>
            </div>
          </div>

          {/* Gráfico de Línea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#3b7c42]" />
                Evolución de precio en el tiempo
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">
                {insumo.history.length} {insumo.history.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            <PriceHistoryChart
              history={insumo.history}
              unit={insumo.purchase_unit}
            />
          </div>

          {/* Sección de Historial Cronológico con Selector de Orden */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#3b7c42]" />
                Registros en orden cronológico
              </span>

              <button
                type="button"
                onClick={() => setIsDescOrder(!isDescOrder)}
                className="text-[11px] font-semibold text-[#3b7c42] hover:text-[#2a4f2f] flex items-center gap-1 bg-[#e5f2e6]/70 px-2.5 py-1 rounded-xl transition"
              >
                <ArrowUpDown className="w-3 h-3" />
                {isDescOrder ? "Más recientes primero" : "Más antiguos primero"}
              </button>
            </div>

            {/* Línea de tiempo de registros */}
            <div className="space-y-2.5">
              {chronologicalList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    item.isLatest
                      ? "bg-white border-[#cce5ce] shadow-xs ring-1 ring-[#cce5ce]/50"
                      : "bg-white/80 border-[#edf2ea]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-800">
                          {formatCurrency(item.price)}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-medium">
                          / {insumo.purchase_unit}
                        </span>

                        {item.isLatest && (
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#e5f2e6] text-[#306236]">
                            Actual
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {new Date(item.date).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    {/* Variación con respecto al precio anterior */}
                    {item.diffAmount !== 0 && (
                      <div
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                          item.diffAmount > 0
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        <span>
                          {item.diffAmount > 0
                            ? `+${formatCurrency(item.diffAmount)}`
                            : formatCurrency(item.diffAmount)}
                        </span>
                        <span className="text-[9px] opacity-80">
                          ({item.diffPct > 0 ? `+${item.diffPct}%` : `${item.diffPct}%`})
                        </span>
                      </div>
                    )}
                  </div>

                  {item.note && (
                    <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-1.5 text-[11px] text-neutral-600">
                      <Tag className="w-3 h-3 text-neutral-400" />
                      <span>{item.note}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Formulario para registrar nuevo precio */}
          <div className="bg-white rounded-3xl p-4 border border-[#e8efe5] shadow-xs">
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full py-2.5 px-4 bg-[#e5f2e6] hover:bg-[#d5ead7] text-[#306236] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                Registrar nuevo precio de compra
              </button>
            ) : (
              <form onSubmit={handleSavePrice} className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#3b7c42]" />
                    Nuevo precio de reposición
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-[11px] text-neutral-400 hover:text-neutral-600 font-medium"
                  >
                    Cancelar
                  </button>
                </div>

                {formError && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100">
                    {formError}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-600 block">
                      Precio ($ ARS) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-neutral-400 pointer-events-none font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        required
                        className="w-full pl-7 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#4f9856] outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-600 block">
                      Fecha *
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#4f9856] outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-600 block">
                    Nota / Proveedor (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Mayorista San Martín, subió el flete..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#4f9856] outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#3b7c42] hover:bg-[#326b38] active:scale-[0.99] text-white font-bold text-xs rounded-2xl shadow-xs transition"
                >
                  Guardar y actualizar histórico
                </button>
              </form>
            )}
          </div>

          {/* Haba mascota tip */}
          <div className="bg-[#eef7ee] border border-[#d6ebd7] rounded-2xl p-3 flex items-center gap-2.5 text-[11px] text-[#306236]">
            <HabaMascot size={36} />
            <p>
              ¡Recordá! HABA siempre calcula tus costos sobre el <strong>precio más reciente</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
