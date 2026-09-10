"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Insumo, PriceRecord } from "@/types/insumo";
import { PriceHistoryDrawer } from "@/components/insumos/PriceHistoryDrawer";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";

export default function InsumosPage() {
  const supabase = createClient();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Limpiar cualquier residuo de mock de versiones anteriores en localStorage
  useEffect(() => {
    try {
      localStorage.removeItem("haba_insumos_v1");
    } catch {
      // Ignorar
    }
  }, []);

  // Cargar insumos exclusivamente desde la base de datos de Supabase
  useEffect(() => {
    async function loadInsumos() {
      try {
        setLoading(true);

        // Consultar la tabla supplies de Supabase
        const { data: suppliesData, error } = await supabase
          .from("supplies")
          .select("*")
          .order("name", { ascending: true });

        if (error || !suppliesData || suppliesData.length === 0) {
          setInsumos([]);
          return;
        }

        // Consultar el historial de precios si existe la tabla
        let historyData: any[] = [];
        try {
          const { data: hData } = await supabase
            .from("supply_price_history")
            .select("*")
            .order("date", { ascending: true });
          if (hData) historyData = hData;
        } catch {
          // Si la tabla no existe o no tiene registros
        }

        // Mapear insumos con su respectivo historial
        const mappedInsumos: Insumo[] = suppliesData.map((item: any) => {
          const itemHistory = historyData
            .filter((h: any) => h.supply_id === item.id || h.insumo_id === item.id)
            .map((h: any) => ({
              id: String(h.id),
              price: Number(h.price),
              date: h.date || h.created_at || new Date().toISOString(),
              note: h.note || h.supplier || undefined,
            }));

          // Si no tiene registros en el historial, creamos el inicial con su precio actual
          const history: PriceRecord[] =
            itemHistory.length > 0
              ? itemHistory
              : [
                  {
                    id: "init-" + item.id,
                    price: Number(item.current_price ?? item.price ?? 0),
                    date: item.updated_at || item.created_at || new Date().toISOString(),
                    note: "Precio inicial",
                  },
                ];

          return {
            id: String(item.id),
            name: item.name || "Sin nombre",
            category: item.category || "Alimentos",
            current_price: Number(item.current_price ?? item.price ?? 0),
            purchase_unit: item.purchase_unit ?? item.unit ?? "u",
            purchase_quantity: item.purchase_quantity ? Number(item.purchase_quantity) : 1,
            recipe_unit: item.recipe_unit,
            updated_at: item.updated_at || item.created_at || new Date().toISOString(),
            history,
          };
        });

        setInsumos(mappedInsumos);
      } catch {
        setInsumos([]);
      } finally {
        setLoading(false);
      }
    }

    loadInsumos();
  }, [supabase]);

  // Abrir el Drawer para un insumo
  const handleOpenDrawer = (insumo: Insumo) => {
    setSelectedInsumo(insumo);
    setIsDrawerOpen(true);
  };

  // Cerrar el Drawer
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Agregar un nuevo registro de precio desde el Drawer
  const handleAddPriceRecord = async (
    insumoId: string,
    newRecordData: Omit<PriceRecord, "id">
  ) => {
    const newRecord: PriceRecord = {
      ...newRecordData,
      id: "rec-" + Date.now(),
    };

    // Actualizar estado local
    setInsumos((prev) =>
      prev.map((item) => {
        if (item.id === insumoId) {
          const updatedHistory = [...item.history, newRecord];
          const sortedByDate = [...updatedHistory].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          const latestPrice = sortedByDate[sortedByDate.length - 1].price;

          const updatedInsumo: Insumo = {
            ...item,
            current_price: latestPrice,
            updated_at: newRecord.date,
            history: updatedHistory,
          };

          setSelectedInsumo(updatedInsumo);
          return updatedInsumo;
        }
        return item;
      })
    );

    // Intentar persistir en Supabase
    try {
      await supabase
        .from("supplies")
        .update({
          current_price: newRecord.price,
          updated_at: newRecord.date,
        })
        .eq("id", insumoId);

      await supabase.from("supply_price_history").insert({
        supply_id: insumoId,
        price: newRecord.price,
        date: newRecord.date,
        note: newRecord.note,
      });
    } catch {
      // Ignorar si falla la inserción en tablas auxiliares
    }
  };

  // Filtros de pestañas
  const filterTabs = [
    { key: "Todos", label: "Todos" },
    { key: "Alimentos", label: "Materia Prima" },
    { key: "Packaging", label: "Packaging" },
    { key: "Otros", label: "Otros" },
  ];

  const filteredInsumos = insumos.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase().trim());
    const matchesCategory =
      selectedCategory === "Todos" ||
      item.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getDaysAgoText = (dateStr: string) => {
    try {
      const diffMs = new Date().getTime() - new Date(dateStr).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return "Actualizado hoy";
      if (diffDays === 1) return "Actualizado ayer";
      return `Actualizado hace ${diffDays} días`;
    } catch {
      return "Actualizado recientemente";
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Mis Insumos</h2>
          <p className="text-xs text-neutral-500">
            Materia prima y packaging con historial de reposición
          </p>
        </div>
        {insumos.length > 0 && (
          <button
            onClick={() => {
              if (filteredInsumos.length > 0) {
                handleOpenDrawer(filteredInsumos[0]);
              }
            }}
            className="p-2.5 bg-[#3b7c42] hover:bg-[#326b38] active:scale-95 text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-semibold"
            title="Ver historial o registrar precio"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo precio</span>
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar harina, azúcar, caja, cinta..."
          className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none shadow-sm transition"
        />
      </div>

      {/* Filtros por pestaña */}
      <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedCategory(tab.key)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
              selectedCategory === tab.key
                ? "bg-white text-[#306236] shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Estado de Carga */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-[#eef2eb] shadow-sm flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-7 h-7 text-[#3b7c42] animate-spin" />
          <p className="text-xs text-neutral-500 font-medium">
            Cargando insumos desde la base de datos...
          </p>
        </div>
      ) : insumos.length === 0 ? (
        /* Estado vacío cuando no hay insumos en la base de datos */
        <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              Aún no tenés insumos cargados
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1 leading-relaxed">
              Cargá los materiales que comprás con su precio actual de reposición para calcular tus recetas.
            </p>
          </div>
        </div>
      ) : filteredInsumos.length === 0 ? (
        /* Sin resultados para la búsqueda */
        <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={70} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              No se encontraron insumos
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              Probá con otro término de búsqueda o seleccioná otra categoría.
            </p>
          </div>
        </div>
      ) : (
        /* Lista de Insumos provenientes de la base de datos */
        <div className="space-y-2.5">
          <div className="bg-[#eaf4ea] border border-[#cbe3cc] rounded-3xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white text-[#3b7c42] flex items-center justify-center font-bold text-sm shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#2a4f2f]">
                  Historial y Gráfico de Precios
                </p>
                <p className="text-[11px] text-[#3b7c42]">
                  Tocá cualquier insumo para abrir el panel lateral con su evolución.
                </p>
              </div>
            </div>
          </div>

          {filteredInsumos.map((insumo) => (
            <div
              key={insumo.id}
              onClick={() => handleOpenDrawer(insumo)}
              className="group bg-white hover:bg-[#fafcfa] active:scale-[0.99] border border-[#edf2ea] hover:border-[#cde3ce] rounded-3xl p-3.5 transition-all shadow-xs cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#f4f8f3] group-hover:bg-[#e5f2e6] border border-[#e2ebd8] flex items-center justify-center text-lg transition-colors">
                  {insumo.category === "Packaging" ? "📦" : "🌾"}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-800 group-hover:text-[#2a4f2f] transition-colors">
                      {insumo.name}
                    </h3>
                    <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                      {insumo.category}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xs sm:text-sm font-extrabold text-[#3b7c42]">
                      {formatCurrency(insumo.current_price)}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      / {insumo.purchase_unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10.5px] text-neutral-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{getDaysAgoText(insumo.updated_at)}</span>
                    <span className="mx-1">•</span>
                    <span>{insumo.history.length} precios</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-neutral-400 group-hover:text-[#3b7c42] transition-colors">
                <span className="hidden sm:inline text-xs font-medium">
                  Ver gráfico
                </span>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer lateral de historial cronológico de precios */}
      <PriceHistoryDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        insumo={selectedInsumo}
        onAddPriceRecord={handleAddPriceRecord}
      />
    </div>
  );
}
