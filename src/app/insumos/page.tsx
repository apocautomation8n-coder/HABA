"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  PackageCheck,
} from "lucide-react";
import { Insumo, PriceRecord } from "@/types/insumo";
import { PriceHistoryDrawer } from "@/components/insumos/PriceHistoryDrawer";
import { BottomNav } from "@/components/BottomNav";

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
      { id: "p6-2", price: 290, date: "2026-06-10", note: "Fabrica de cajas" },
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
      // Usar estado inicial si falla
    }
  }, []);

  // Guardar en localStorage ante cambios
  const saveInsumos = (newList: Insumo[]) => {
    setInsumos(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignorar errores en modo incógnito/storage lleno
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
  const handleAddPriceRecord = (insumoId: string, newRecordData: Omit<PriceRecord, "id">) => {
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

  // Filtros
  const categories = ["Todos", "Alimentos", "Packaging", "Otros"];

  const filteredInsumos = insumos.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchesCategory =
      selectedCategory === "Todos" || item.category.toLowerCase() === selectedCategory.toLowerCase();
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
    <div className="w-full flex flex-col pb-24 pt-2 space-y-4">
      {/* Barra superior con navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-full bg-white border border-[#eef2eb] flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition shadow-xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-extrabold text-neutral-800 tracking-tight">
            Mis insumos
          </h1>
        </div>

        <button
          onClick={() => {
            if (filteredInsumos.length > 0) {
              handleOpenDrawer(filteredInsumos[0]);
            }
          }}
          className="w-9 h-9 rounded-full bg-[#3b7c42] hover:bg-[#326b38] text-white flex items-center justify-center shadow-xs transition active:scale-95"
          title="Ver historial o agregar"
        >
          <Plus className="w-5 h-5" />
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
          placeholder="Buscar insumo..."
          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-[#e2e8df] rounded-2xl focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none transition shadow-xs"
        />
      </div>

      {/* Categorías (Pills) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? "bg-[#3b7c42] text-white shadow-xs"
                : "bg-white text-neutral-600 border border-[#eef2eb] hover:bg-neutral-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Banner explicativo del historial cronológico */}
      <div className="bg-[#eaf4ea] border border-[#cbe3cc] rounded-3xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white text-[#3b7c42] flex items-center justify-center font-bold text-sm shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#2a4f2f]">
              Historial de precios
            </p>
            <p className="text-[11px] text-[#3b7c42]">
              Tocá cualquier insumo para ver su gráfico y evolución cronológica.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Insumos */}
      <div className="space-y-2.5">
        {filteredInsumos.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#eef2eb] space-y-2">
            <p className="text-sm font-semibold text-neutral-600">
              No se encontraron insumos
            </p>
            <p className="text-xs text-neutral-400">
              Probá con otro término de búsqueda o categoría.
            </p>
          </div>
        ) : (
          filteredInsumos.map((insumo) => (
            <div
              key={insumo.id}
              onClick={() => handleOpenDrawer(insumo)}
              className="group bg-white hover:bg-[#fafcfa] active:scale-[0.99] border border-[#edf2ea] hover:border-[#cde3ce] rounded-3xl p-3.5 sm:p-4 transition-all shadow-xs cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                {/* Icono de Insumo kawaii */}
                <div className="w-11 h-11 rounded-2xl bg-[#f4f8f3] group-hover:bg-[#e5f2e6] border border-[#e2ebd8] flex items-center justify-center text-lg transition-colors">
                  {insumo.category === "Packaging" ? "📦" : "🌾"}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-800 group-hover:text-[#2a4f2f] transition-colors">
                      {insumo.name}
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                      {insumo.category}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm font-extrabold text-[#3b7c42]">
                      {formatCurrency(insumo.current_price)}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">
                      / {insumo.purchase_unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{getDaysAgoText(insumo.updated_at)}</span>
                    <span className="mx-1">•</span>
                    <span>{insumo.history.length} registros</span>
                  </div>
                </div>
              </div>

              {/* Botón trigger para el Drawer */}
              <div className="flex items-center gap-1.5 text-neutral-400 group-hover:text-[#3b7c42] transition-colors">
                <span className="hidden sm:inline text-xs font-semibold">
                  Ver gráfico
                </span>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Drawer lateral de historial cronológico */}
      <PriceHistoryDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        insumo={selectedInsumo}
        onAddPriceRecord={handleAddPriceRecord}
      />

      {/* Barra de navegación inferior */}
      <BottomNav />
    </div>
  );
}
