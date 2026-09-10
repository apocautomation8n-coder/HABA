"use client";

import React, { useEffect, useState } from "react";
import { X, History, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";
import { SupplyItem } from "@/components/SupplyModal";

interface PriceHistoryEntry {
  id: string;
  price: number;
  changed_at: string;
}

interface SupplyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supply: SupplyItem | null;
}

export const SupplyHistoryModal: React.FC<SupplyHistoryModalProps> = ({
  isOpen,
  onClose,
  supply,
}) => {
  const supabase = createClient();
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      if (!supply?.id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("supply_price_history")
          .select("*")
          .eq("supply_id", supply.id)
          .order("changed_at", { ascending: false });

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
    }
  }, [isOpen, supply, supabase]);

  if (!isOpen || !supply) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto border border-[#eef2eb] animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800">Historial de Precios</h3>
              <p className="text-[11px] text-neutral-400 font-medium truncate max-w-[200px]">
                {supply.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Precio Actual Destacado */}
        <div className="mt-4 p-3.5 bg-[#e5f2e6] border border-[#cce5ce] rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#306236] uppercase tracking-wider block">
              Precio Actual
            </span>
            <span className="text-xs text-[#3b7c42]">
              por {supply.purchase_quantity} {supply.purchase_unit}
            </span>
          </div>
          <span className="text-lg font-black text-[#244228]">
            {formatCurrency(supply.current_price)}
          </span>
        </div>

        {/* Timeline de Historial */}
        <div className="mt-4 space-y-2.5">
          <h4 className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-neutral-400" />
            Precios Anteriores Registrados
          </h4>

          {loading ? (
            <p className="text-xs text-neutral-400 text-center py-6">Cargando historial...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-6 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              <AlertCircle className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-neutral-600">Sin variaciones aún</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Cada vez que actualices el precio de reposición de este insumo, se guardará el histórico aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const date = new Date(item.changed_at);
                const formattedDate = date.toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const formattedTime = date.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <div>
                        <span className="text-xs font-medium text-neutral-700 block">
                          {formattedDate}
                        </span>
                        <span className="text-[10px] text-neutral-400">{formattedTime} hs</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-800">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-2xl text-xs transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
