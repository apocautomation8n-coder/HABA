"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  X,
  History,
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowUpDown,
  Tag,
  Plus,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";
import { SupplyItem } from "@/components/SupplyModal";
import { PriceHistoryChart } from "@/components/insumos/PriceHistoryChart";
import { HabaMascot } from "@/components/HabaMascot";

interface PriceHistoryEntry {
  id: string;
  price: number;
  changed_at: string;
  note?: string;
}

interface SupplyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supply: SupplyItem | null;
  onPriceUpdated?: () => void;
}

export const SupplyHistoryModal: React.FC<SupplyHistoryModalProps> = ({
  isOpen,
  onClose,
  supply,
  onPriceUpdated,
}) => {
  const supabase = createClient();
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDescOrder, setIsDescOrder] = useState<boolean>(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      if (!supply?.id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("supply_price_history")
          .select("*")
          .eq("supply_id", supply.id)
          .order("changed_at", { ascending: true });

        if (!error && data) {
          setHistory(data);
        }
      } catch (err) {
        console.error("Error loading price history:", err);
      } finally {
        setLoading(false);
      }
    }

    if (isOpen && supply) {
      loadHistory();
      setNewDate(new Date().toISOString().split("T")[0]);
      setShowAddForm(false);
      setNewPrice("");
      setNewNote("");
    }
  }, [isOpen, supply, supabase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  const allPricePoints = useMemo(() => {
    if (!supply) return [];

    const points = history.map((item) => ({
      id: item.id,
      price: item.price,
      date: item.changed_at,
      note: item.note,
    }));

    const hasCurrent = points.some((p) => p.price === supply.current_price);
    if (!hasCurrent && supply.current_price > 0) {
      points.push({
        id: "current-" + (supply.id || "0"),
        price: supply.current_price,
        date: supply.updated_at || new Date().toISOString(),
        note: "Precio de reposición actual",
      });
    }

    return points.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [history, supply]);

  const chronologicalList = useMemo(() => {
    const withDiffs = allPricePoints.map((record, index) => {
      let diffAmount = 0;
      let diffPct = 0;
      if (index > 0) {
        const prev = allPricePoints[index - 1].price;
        diffAmount = record.price - prev;
        diffPct = prev > 0 ? Math.round(((record.price - prev) / prev) * 100) : 0;
      }
      return {
        ...record,
        diffAmount,
        diffPct,
        isLatest: index === allPricePoints.length - 1,
      };
    });

    return isDescOrder ? [...withDiffs].reverse() : withDiffs;
  }, [allPricePoints, isDescOrder]);

  const metrics = useMemo(() => {
    if (allPricePoints.length === 0) {
      return { totalVariationPct: 0, minPrice: 0, maxPrice: 0 };
    }
    const prices = allPricePoints.map((p) => p.price);
    const first = allPricePoints[0].price;
    const last = allPricePoints[allPricePoints.length - 1].price;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const totalVariationPct =
      first > 0 ? Math.round(((last - first) / first) * 100) : 0;

    return { totalVariationPct, minPrice, maxPrice };
  }, [allPricePoints]);

  const handleSaveNewPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supply?.id) return;
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    try {
      setSaving(true);
      const isoDate = newDate ? new Date(newDate).toISOString() : new Date().toISOString();

      const { error: histError } = await supabase.from("supply_price_history").insert({
        supply_id: supply.id,
        price: priceNum,
        changed_at: isoDate,
      });

      await supabase
        .from("supplies")
        .update({
          current_price: priceNum,
          updated_at: isoDate,
        })
        .eq("id", supply.id);

      if (!histError) {
        setHistory((prev) => [
          ...prev,
          {
            id: "temp-" + Date.now(),
            price: priceNum,
            changed_at: isoDate,
            note: newNote.trim() || undefined,
          },
        ]);
        supply.current_price = priceNum;
        setShowAddForm(false);
        setNewPrice("");
        setNewNote("");
        onPriceUpdated?.();
      }
    } catch (err) {
      console.error("Error saving new price:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !supply) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer lateral */}
      <div
        className={`fixed inset-y-0 right-0 max-w-full flex w-full sm:max-w-md bg-[#F6F7F2] shadow-2xl transition-transform duration-300 ease-out flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabecera sticky */}
        <div className="p-4 sm:p-5 border-b border-[#EAF0E8] bg-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#DCF4D7] text-[#3BB578] flex items-center justify-center font-bold text-lg">
              {supply.category === "packaging" ? "📦" : "🌾"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#2B2B2B] leading-tight font-display">
                  {supply.name}
                </h3>
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    supply.category === "packaging"
                      ? "bg-amber-100/70 text-amber-800"
                      : "bg-[#DCF4D7] text-[#1F7A4C]"
                  }`}
                >
                  {supply.category === "packaging" ? "Packaging" : "Materia Prima"}
                </span>
              </div>
              <p className="text-xs text-[#7A7A7A] mt-0.5 font-body">
                Historial cronológico de precios
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-[#7A7A7A] flex items-center justify-center transition active:scale-95"
            title="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Tarjetas de métricas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3.5 rounded-3xl border border-[#EAF0E8] shadow-xs">
              <span className="text-[11px] font-medium text-[#7A7A7A] block">
                Precio actual (reposición)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-[#1F7A4C]">
                  {formatCurrency(supply.current_price)}
                </span>
                <span className="text-xs font-semibold text-[#7A7A7A]">
                  / {supply.purchase_unit}
                </span>
              </div>
              <p className="text-[10px] text-[#7A7A7A] mt-1">
                Base para costeo de productos
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-3xl border border-[#EAF0E8] shadow-xs">
              <span className="text-[11px] font-medium text-[#7A7A7A] block">
                Variación histórica
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-xl font-extrabold ${
                    metrics.totalVariationPct > 0
                      ? "text-rose-600"
                      : metrics.totalVariationPct < 0
                      ? "text-emerald-600"
                      : "text-[#2B2B2B]"
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
              <p className="text-[10px] text-[#7A7A7A] mt-1">
                Rango: {formatCurrency(metrics.minPrice)} - {formatCurrency(metrics.maxPrice)}
              </p>
            </div>
          </div>

          {/* Gráfico */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#2B2B2B] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#3BB578]" />
                Evolución de precio en el tiempo
              </span>
              <span className="text-[11px] text-[#7A7A7A] font-medium">
                {allPricePoints.length} {allPricePoints.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            <PriceHistoryChart
              history={allPricePoints}
              unit={supply.purchase_unit}
            />
          </div>

          {/* Historial cronológico */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2B2B2B] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#3BB578]" />
                Historial cronológico
              </span>

              {allPricePoints.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsDescOrder(!isDescOrder)}
                  className="text-[11px] font-semibold text-[#3BB578] hover:text-[#1F7A4C] flex items-center gap-1 bg-[#DCF4D7]/70 px-2.5 py-1 rounded-xl transition"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {isDescOrder ? "Más recientes primero" : "Más antiguos primero"}
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-[#7A7A7A] text-center py-6">
                Cargando historial...
              </p>
            ) : allPricePoints.length === 0 ? (
              <div className="text-center py-6 px-4 bg-white rounded-2xl border border-dashed border-neutral-200">
                <AlertCircle className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-[#2B2B2B]">Sin variaciones aún</p>
                <p className="text-[11px] text-[#7A7A7A] mt-0.5">
                  Cada vez que actualices el precio de este insumo, se guardará el histórico aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chronologicalList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-3 rounded-2xl border transition-all ${
                      item.isLatest
                        ? "bg-white border-[#C3EBC0] shadow-xs ring-1 ring-[#C3EBC0]/50"
                        : "bg-white/80 border-[#EAF0E8]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#2B2B2B]">
                            {formatCurrency(item.price)}
                          </span>
                          <span className="text-[11px] text-[#7A7A7A] font-medium">
                            / {supply.purchase_unit}
                          </span>

                          {item.isLatest && (
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#DCF4D7] text-[#1F7A4C]">
                              Actual
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#7A7A7A] mt-0.5">
                          {new Date(item.date).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>

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
                      <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-1.5 text-[11px] text-[#7A7A7A]">
                        <Tag className="w-3 h-3 text-neutral-400" />
                        <span>{item.note}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario nuevo precio */}
          <div className="bg-white rounded-3xl p-4 border border-[#EAF0E8] shadow-xs">
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full py-2.5 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                Registrar nuevo precio de compra
              </button>
            ) : (
              <form onSubmit={handleSaveNewPrice} className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <span className="text-xs font-bold text-[#2B2B2B] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#3BB578]" />
                    Nuevo precio de reposición
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-[11px] text-[#7A7A7A] hover:text-[#2B2B2B] font-medium"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#7A7A7A] block">
                      Precio (\$ ARS) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#7A7A7A] block">
                      Fecha *
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#7A7A7A] block">
                    Nota / Proveedor (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Mayorista Makro, subió flete..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white font-bold text-xs rounded-2xl shadow-xs transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar y actualizar precio"}
                </button>
              </form>
            )}
          </div>

          {/* Tip mascota */}
          <div className="bg-[#DCF4D7] border border-[#C3EBC0] rounded-2xl p-3 flex items-center gap-2.5 text-[11px] text-[#1F7A4C]">
            <HabaMascot size={36} />
            <p>
              ¡Recordá! HABA siempre calcula tus costos sobre el <strong>precio más reciente</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
