"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Boxes, Plus, Search, Sparkles, Edit2, History, Trash2, Package, Tag, Layers } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, calculateUnitCost } from "@/lib/units";
import { SupplyModal, SupplyItem } from "@/components/SupplyModal";
import { SupplyHistoryModal } from "@/components/SupplyHistoryModal";

export default function InsumosPage() {
  const supabase = createClient();

  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "materia_prima" | "packaging">("todos");
  const [search, setSearch] = useState("");

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyItem | null>(null);
  const [historySupply, setHistorySupply] = useState<SupplyItem | null>(null);

  const loadSupplies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("supplies")
        .select("*")
        .order("name", { ascending: true });

      if (!error && data) {
        setSupplies(data as SupplyItem[]);
      }
    } catch (err) {
      console.error("Error loading supplies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplies();
  }, []);

  const handleDelete = async (supply: SupplyItem) => {
    if (!supply.id) return;
    const confirmDelete = window.confirm(
      `¿Estás segura de eliminar "${supply.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from("supplies").delete().eq("id", supply.id);
      if (!error) {
        setSupplies((prev) => prev.filter((s) => s.id !== supply.id));
      } else {
        alert("No se pudo eliminar el insumo: " + error.message);
      }
    } catch (err: any) {
      alert("Error al eliminar el insumo: " + err.message);
    }
  };

  const filteredSupplies = useMemo(() => {
    return supplies.filter((item) => {
      const matchesCategory = filter === "todos" || item.category === filter;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [supplies, filter, search]);

  const counts = useMemo(() => {
    return {
      total: supplies.length,
      materia_prima: supplies.filter((s) => s.category === "materia_prima").length,
      packaging: supplies.filter((s) => s.category === "packaging").length,
    };
  }, [supplies]);

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <span>Insumos</span>
            <span className="text-xs bg-[#e5f2e6] text-[#306236] font-semibold px-2 py-0.5 rounded-full">
              {supplies.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-500">Materia prima y packaging con precio de reposición</p>
        </div>
        <button
          onClick={() => {
            setEditingSupply(null);
            setIsModalOpen(true);
          }}
          className="py-2 px-3.5 bg-[#3b7c42] hover:bg-[#326b38] active:scale-[0.98] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar insumo (ej: harina, caja, tela...)"
          className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none shadow-sm transition"
        />
      </div>

      {/* Filtros por pestaña */}
      <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
        {(
          [
            { key: "todos", label: `Todos (${counts.total})` },
            { key: "materia_prima", label: `Materia Prima (${counts.materia_prima})` },
            { key: "packaging", label: `Packaging (${counts.packaging})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-xl transition ${
              filter === tab.key
                ? "bg-white text-[#306236] shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listado de Insumos */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
          <HabaMascot size={60} className="animate-bounce" />
          <p className="text-xs text-neutral-400">Cargando tus insumos...</p>
        </div>
      ) : filteredSupplies.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={75} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              {search ? "No se encontraron insumos con ese nombre" : "Aún no tenés insumos cargados"}
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              {search
                ? "Probá con otra búsqueda o agregalo como un nuevo insumo."
                : "Cargá los materiales que comprás para que Haba calcule el costo exacto de tus productos."}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingSupply(null);
              setIsModalOpen(true);
            }}
            className="mt-2 py-2.5 px-4 bg-[#e5f2e6] hover:bg-[#cce5ce] text-[#306236] text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Cargar mi primer insumo</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSupplies.map((supply) => {
            const unitCost = calculateUnitCost(
              supply.current_price,
              supply.purchase_quantity,
              supply.conversion_factor
            );

            return (
              <div
                key={supply.id}
                className="bg-white rounded-3xl p-4 border border-[#eef2eb] shadow-sm hover:shadow-md transition flex flex-col space-y-3"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        supply.category === "packaging"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-[#e5f2e6] text-[#3b7c42]"
                      }`}
                    >
                      {supply.category === "packaging" ? (
                        <Package className="w-5 h-5" />
                      ) : (
                        <Layers className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-800 leading-snug">
                        {supply.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            supply.category === "packaging"
                              ? "bg-amber-100/70 text-amber-800"
                              : "bg-[#e5f2e6] text-[#306236]"
                          }`}
                        >
                          {supply.category === "packaging" ? "Packaging" : "Materia Prima"}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {supply.purchase_quantity} {supply.purchase_unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setHistorySupply(supply)}
                      className="p-1.5 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition"
                      title="Ver historial de precios"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingSupply(supply);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-[#3b7c42] hover:bg-[#e5f2e6] rounded-xl transition"
                      title="Editar insumo"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(supply)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Eliminar insumo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Precios y Costo Unitario */}
                <div className="bg-neutral-50 rounded-2xl p-3 flex items-center justify-between border border-neutral-100">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-medium">
                      Precio de Reposición
                    </span>
                    <span className="text-xs font-bold text-neutral-700">
                      {formatCurrency(supply.current_price)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#306236] block font-semibold">
                      Costo por {supply.use_unit}
                    </span>
                    <span className="text-sm font-black text-[#244228]">
                      {formatCurrency(unitCost)}
                      <span className="text-[10px] font-normal text-neutral-400">
                        /{supply.use_unit}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Crear / Editar Insumo */}
      <SupplyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSupply(null);
        }}
        onSuccess={loadSupplies}
        initialSupply={editingSupply}
      />

      {/* Modal de Historial de Precios */}
      <SupplyHistoryModal
        isOpen={!!historySupply}
        onClose={() => setHistorySupply(null)}
        supply={historySupply}
      />
    </div>
  );
}
