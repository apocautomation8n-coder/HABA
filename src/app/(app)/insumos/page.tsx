"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
} from "lucide-react";
import { Insumo, PriceRecord } from "@/types/insumo";
import { PriceHistoryDrawer } from "@/components/insumos/PriceHistoryDrawer";
import { HabaMascot } from "@/components/HabaMascot";

// Datos iniciales de insumos basados en los mockups oficiales de HABA
const INITIAL_INSUMOS: Insumo[] = [
  {
    id: "insumo-1",
    name: "Harina 000",
    category: "Alimentos",
    current_price: 2500,
    purchase_unit: "kg",
    purchase_quantity: 1,
    recipe_unit: "g",
    updated_at: "2026-09-08",
    history: [
      { id: "p1-1", price: 1800, date: "2026-04-10", note: "Distribuidora San Martín" },
      { id: "p1-2", price: 2000, date: "2026-05-20", note: "Compra bulto cerrado" },
      { id: "p1-3", price: 2150, date: "2026-06-15", note: "Ajuste de precio proveedor" },
      { id: "p1-4", price: 2300, date: "2026-07-28", note: "Supermercado Mayorista" },
      { id: "p1-5", price: 2500, date: "2026-09-08", note: "Última reposición" },
    ],
  },
  {
    id: "insumo-2",
    name: "Azúcar",
    category: "Alimentos",
    current_price: 1200,
    purchase_unit: "kg",
    purchase_quantity: 1,
    recipe_unit: "g",
    updated_at: "2026-09-05",
    history: [
      { id: "p2-1", price: 950, date: "2026-05-12", note: "Oferta por 10 paquetes" },
      { id: "p2-2", price: 1050, date: "2026-06-30", note: "Mayorista" },
      { id: "p2-3", price: 1150, date: "2026-08-10", note: "Aumento por flete" },
      { id: "p2-4", price: 1200, date: "2026-09-05", note: "Reposición habitual" },
    ],
  },
  {
    id: "insumo-3",
    name: "Manteca",
    category: "Alimentos",
    current_price: 4500,
    purchase_unit: "kg",
    purchase_quantity: 1,
    recipe_unit: "g",
    updated_at: "2026-09-07",
    history: [
      { id: "p3-1", price: 3200, date: "2026-04-01", note: "Lácteos del Sur" },
      { id: "p3-2", price: 3800, date: "2026-06-15", note: "Distribuidora" },
      { id: "p3-3", price: 4100, date: "2026-07-20", note: "Ajuste invernal" },
      { id: "p3-4", price: 4500, date: "2026-09-07", note: "Caja por 10kg" },
    ],
  },
  {
    id: "insumo-4",
    name: "Huevos",
    category: "Alimentos",
    current_price: 650,
    purchase_unit: "u",
    purchase_quantity: 30,
    recipe_unit: "u",
    updated_at: "2026-09-07",
    history: [
      { id: "p4-1", price: 500, date: "2026-06-01", note: "Granja local" },
      { id: "p4-2", price: 580, date: "2026-07-15", note: "Maple x 30" },
      { id: "p4-3", price: 650, date: "2026-09-07", note: "Aumento de granja" },
    ],
  },
  {
    id: "insumo-5",
    name: "Cacao en polvo",
    category: "Alimentos",
    current_price: 2300,
    purchase_unit: "kg",
    purchase_quantity: 1,
    recipe_unit: "g",
    updated_at: "2026-09-04",
    history: [
      { id: "p5-1", price: 1800, date: "2026-05-10", note: "Distribuidora Repostería" },
      { id: "p5-2", price: 2050, date: "2026-07-02", note: "Cacao alcalino" },
      { id: "p5-3", price: 2300, date: "2026-09-04", note: "Bolsa x 5kg" },
    ],
  },
  {
    id: "insumo-6",
    name: "Cajas de cartón",
    category: "Packaging",
    current_price: 350,
    purchase_unit: "u",
    purchase_quantity: 50,
    recipe_unit: "u",
    updated_at: "2026-09-02",
    history: [
      { id: "p6-1", price: 250, date: "2026-04-20", note: "Pack x 100 kraft" },
      { id: "p6-2", price: 290, date: "2026-06-10", note: "Fábrica de cajas" },
      { id: "p6-3", price: 320, date: "2026-08-15", note: "Aumento papel" },
      { id: "p6-4", price: 350, date: "2026-09-02", note: "Último pedido" },
    ],
  },
];

const STORAGE_KEY = "haba_insumos_v1";

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>(INITIAL_INSUMOS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Cargar datos persistidos en localStorage si existen
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInsumos(parsed);
        }
      }
    } catch {
      // Usar datos iniciales si no hay localStorage
    }
  }, []);

  // Guardar en localStorage ante cambios
  const saveInsumos = (newList: Insumo[]) => {
    setInsumos(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignorar errores
    }
  };

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
  const handleAddPriceRecord = (
    insumoId: string,
    newRecordData: Omit<PriceRecord, "id">
  ) => {
    const newRecord: PriceRecord = {
      ...newRecordData,
      id: "rec-" + Date.now(),
    };

    const updated = insumos.map((item) => {
      if (item.id === insumoId) {
        const updatedHistory = [...item.history, newRecord];
        // Determinar el nuevo precio actual (el más reciente por fecha)
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

        // Actualizar el insumo activo en el drawer
        setSelectedInsumo(updatedInsumo);
        return updatedInsumo;
      }
      return item;
    });

    saveInsumos(updated);
  };

  // Filtros de categorías compatibles con la vista de Eze y los mockups
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
        <button
          onClick={() => {
            if (filteredInsumos.length > 0) {
              handleOpenDrawer(filteredInsumos[0]);
            }
          }}
          className="p-2.5 bg-[#3b7c42] hover:bg-[#326b38] active:scale-95 text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-semibold"
          title="Ver historial o agregar"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo precio</span>
        </button>
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
          placeholder="Buscar harina, azúcar, caja, manteca..."
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

      {/* Banner explicativo del historial cronológico */}
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

      {/* Lista de Insumos */}
      <div className="space-y-2.5">
        {filteredInsumos.length === 0 ? (
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
          filteredInsumos.map((insumo) => (
            <div
              key={insumo.id}
              onClick={() => handleOpenDrawer(insumo)}
              className="group bg-white hover:bg-[#fafcfa] active:scale-[0.99] border border-[#edf2ea] hover:border-[#cde3ce] rounded-3xl p-3.5 transition-all shadow-xs cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {/* Icono de Insumo kawaii */}
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

              {/* Trigger lateral */}
              <div className="flex items-center gap-1 text-neutral-400 group-hover:text-[#3b7c42] transition-colors">
                <span className="hidden sm:inline text-xs font-medium">
                  Ver gráfico
                </span>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))
        )}
      </div>

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
