"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Boxes,
  Plus,
  Search,
  Sparkles,
  Edit2,
  History,
  Trash2,
  Package,
  Layers,
  Clock,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, calculateUnitCost } from "@/lib/units";
import { SupplyModal, SupplyItem } from "@/components/SupplyModal";
import { PriceHistoryDrawer } from "@/components/insumos/PriceHistoryDrawer";
import { DeleteSupplyModal } from "@/components/insumos/DeleteSupplyModal";
import { Insumo, PriceRecord } from "@/types/insumo";

export default function InsumosPage() {
  const supabase = createClient();

  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "materia_prima" | "packaging">("todos");
  const [search, setSearch] = useState("");

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyItem | null>(null);

  // Modal de Eliminación con Validación de Integridad
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplyToDelete, setSupplyToDelete] = useState<SupplyItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Rolan's Price History Drawer integration
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedInsumoForDrawer, setSelectedInsumoForDrawer] = useState<Insumo | null>(null);

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

  const handleRequestDelete = (supply: SupplyItem) => {
    setSupplyToDelete(supply);
    setIsDeleteModalOpen(true);
  };

  const handleSupplyDeleted = (deletedId: string) => {
    setSupplies((prev) => prev.filter((s) => s.id !== deletedId));
    setToastMessage("Insumo eliminado de tu catálogo con éxito.");
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Abrir Drawer de Rolan cargando el histórico real desde Supabase
  const handleOpenHistoryDrawer = async (supply: SupplyItem) => {
    if (!supply.id) return;

    try {
      const { data: historyData } = await supabase
        .from("supply_price_history")
        .select("*")
        .eq("supply_id", supply.id)
        .order("date", { ascending: true });

      const records: PriceRecord[] =
        historyData && historyData.length > 0
          ? historyData.map((h: any) => ({
              id: String(h.id),
              price: Number(h.price),
              date: h.date || h.created_at || new Date().toISOString(),
              note: h.note || undefined,
            }))
          : [
              {
                id: "init-" + supply.id,
                price: Number(supply.current_price),
                date: supply.updated_at || supply.created_at || new Date().toISOString(),
                note: "Precio de reposición actual",
              },
            ];

      const insumoModel: Insumo = {
        id: supply.id,
        name: supply.name,
        category: supply.category === "packaging" ? "Packaging" : "Materia Prima",
        current_price: supply.current_price,
        purchase_unit: supply.purchase_unit,
        purchase_quantity: supply.purchase_quantity,
        updated_at: supply.updated_at || supply.created_at || new Date().toISOString(),
        history: records,
      };

      setSelectedInsumoForDrawer(insumoModel);
      setIsDrawerOpen(true);
    } catch (err) {
      console.error("Error opening history drawer:", err);
    }
  };

  // Guardar nuevo registro de precio desde el Drawer
  const handleAddPriceFromDrawer = async (
    insumoId: string,
    newRecordData: Omit<PriceRecord, "id">
  ) => {
    try {
      // 1. Actualizar el precio actual del insumo en supplies
      await supabase
        .from("supplies")
        .update({
          current_price: newRecordData.price,
          updated_at: newRecordData.date,
        })
        .eq("id", insumoId);

      // 2. Insertar en supply_price_history
      await supabase.from("supply_price_history").insert({
        supply_id: insumoId,
        price: newRecordData.price,
        date: newRecordData.date,
        note: newRecordData.note,
      });

      // Recargar lista y actualizar estado local
      await loadSupplies();

      if (selectedInsumoForDrawer && selectedInsumoForDrawer.id === insumoId) {
        const newRecord: PriceRecord = {
          ...newRecordData,
          id: "rec-" + Date.now(),
        };
        setSelectedInsumoForDrawer({
          ...selectedInsumoForDrawer,
          current_price: newRecordData.price,
          updated_at: newRecordData.date,
          history: [...selectedInsumoForDrawer.history, newRecord],
        });
      }
    } catch (err: any) {
      alert("Error al actualizar precio: " + err.message);
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
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <span>Insumos</span>
            <span className="text-xs bg-[#DCF4D7] text-[#1F7A4C] font-semibold px-2 py-0.5 rounded-full">
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
          className="py-2 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.98] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold"
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
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none shadow-sm transition"
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
                ? "bg-white text-[#1F7A4C] shadow-sm"
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
        <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
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
            className="mt-2 py-2.5 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm"
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
                className="bg-white rounded-3xl p-4 border border-[#EAF0E8] shadow-sm hover:shadow-md transition flex flex-col space-y-3"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
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
                    <div>
                      <h4 className="text-sm font-bold text-neutral-800 leading-snug">
                        {supply.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            supply.category === "packaging"
                              ? "bg-amber-100/70 text-amber-800"
                              : "bg-[#DCF4D7] text-[#1F7A4C]"
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
                      onClick={() => handleOpenHistoryDrawer(supply)}
                      className="p-1.5 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition"
                      title="Ver gráfico e historial de precios"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingSupply(supply);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-[#3BB578] hover:bg-[#DCF4D7] rounded-xl transition"
                      title="Editar insumo"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRequestDelete(supply)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Eliminar insumo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Precios y Costo Unitario */}
                <div
                  onClick={() => handleOpenHistoryDrawer(supply)}
                  className="bg-neutral-50 hover:bg-[#f3f8f3] cursor-pointer rounded-2xl p-3 flex items-center justify-between border border-neutral-100 transition"
                >
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-medium">
                      Precio de Reposición (ARS)
                    </span>
                    <span className="text-xs font-bold text-neutral-700">
                      {formatCurrency(supply.current_price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-[#1F7A4C] block font-semibold">
                        Costo por {supply.use_unit}
                      </span>
                      <span className="text-sm font-black text-[#1F7A4C]">
                        {formatCurrency(unitCost)}
                        <span className="text-[10px] font-normal text-neutral-400">
                          /{supply.use_unit}
                        </span>
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notificación flotante de confirmación (Toast Kawaii) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#244228] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
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

      {/* Modal de Eliminación con Validación de Integridad Referencial */}
      <DeleteSupplyModal
        isOpen={isDeleteModalOpen}
        supply={supplyToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSupplyToDelete(null);
        }}
        onSuccess={handleSupplyDeleted}
      />

      {/* Drawer Lateral de Historial y Gráfico de Precios (Rolan integration) */}
      <PriceHistoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        insumo={selectedInsumoForDrawer}
        onAddPriceRecord={handleAddPriceFromDrawer}
      />
    </div>
  );
}
