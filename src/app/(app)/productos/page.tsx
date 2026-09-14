"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Tag,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Power,
  X,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Package,
  Copy,
  Loader2,
  Receipt,
  Boxes,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, calculateUnitCost } from "@/lib/units";
import {
  PRODUCT_CATEGORIES,
  parseProductMeta,
  serializeProductDescription,
  getCategoryBadge,
  ProductCategory,
} from "@/lib/products";

interface ProductPrice {
  id: string;
  channel_name: string;
  profit_margin_percent: number;
  selling_price: number;
}

export interface ProductSupplyItem {
  id: string;
  quantity: number;
  supply_id: string;
  supplies?: {
    id: string;
    name: string;
    category?: string;
    current_price: number;
    use_unit?: string;
    purchase_unit?: string;
    purchase_quantity?: number;
    conversion_factor?: number;
  } | null;
}

interface Product {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  work_time_minutes: number;
  include_labor: boolean;
  direct_cost: number;
  labor_cost: number;
  indirect_cost: number;
  total_cost: number;
  needs_price_review: boolean;
  created_at: string;
  product_prices?: ProductPrice[];
  product_supplies?: ProductSupplyItem[];
}

export default function ProductosPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);

  // Acordeón desplegado
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Cargar productos con sus precios asociados
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_prices (*),
          product_supplies (
            id,
            quantity,
            supply_id,
            supplies (
              id,
              name,
              category,
              current_price,
              use_unit,
              purchase_unit,
              purchase_quantity,
              conversion_factor
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProducts(data as Product[]);
      } else if (error) {
        console.error("Error fetching products:", error);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Cambiar estado activo/inactivo (optimista + Supabase)
  const handleToggleStatus = async (product: Product, currentIsActive: boolean) => {
    if (togglingId) return;
    const nextIsActive = !currentIsActive;
    setTogglingId(product.id);

    const meta = parseProductMeta(product.description);
    const newDescription = serializeProductDescription({
      cleanDescription: meta.cleanDescription,
      category: meta.category,
      isActive: nextIsActive,
    });

    // Actualización optimista en el estado
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, description: newDescription } : p))
    );

    try {
      const { error } = await supabase
        .from("products")
        .update({ description: newDescription })
        .eq("id", product.id);

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("Error actualizando estado:", err);
      alert("No se pudo actualizar el estado: " + (err.message || "Error"));
      // Rollback
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, description: product.description } : p))
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Eliminar producto y sus relaciones
  const handleDelete = async (product: Product) => {
    const confirmDelete = window.confirm(
      `¿Estás segura de eliminar el producto "${product.name}"? Se borrará de tu catálogo.`
    );
    if (!confirmDelete) return;

    try {
      // 1. Eliminar relaciones primero
      await supabase.from("product_supplies").delete().eq("product_id", product.id);
      await supabase.from("product_prices").delete().eq("product_id", product.id);
      const { error } = await supabase.from("products").delete().eq("id", product.id);

      if (!error) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else {
        alert("No se pudo eliminar el producto: " + error.message);
      }
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  // Duplicar producto (clonar receta, precios y datos base)
  const handleDuplicate = async (product: Product) => {
    if (duplicatingId) return;
    try {
      setDuplicatingId(product.id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sesión no válida");

      // 1. Obtener los insumos de la receta original
      const { data: originalSupplies, error: suppliesFetchErr } = await supabase
        .from("product_supplies")
        .select("supply_id, quantity")
        .eq("product_id", product.id);

      if (suppliesFetchErr) {
        console.error("Error al obtener insumos:", suppliesFetchErr);
      }

      // 2. Obtener los precios de canales originales
      const { data: originalPrices, error: pricesFetchErr } = await supabase
        .from("product_prices")
        .select("channel_name, profit_margin_percent, selling_price")
        .eq("product_id", product.id);

      if (pricesFetchErr) {
        console.error("Error al obtener precios:", pricesFetchErr);
      }

      const clonedName = `${product.name} (copia)`;

      // 3. Insertar el nuevo producto en la tabla products
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: clonedName,
          description: product.description,
          work_time_minutes: product.work_time_minutes,
          include_labor: product.include_labor,
          direct_cost: product.direct_cost,
          labor_cost: product.labor_cost,
          indirect_cost: product.indirect_cost,
          total_cost: product.total_cost,
          needs_price_review: false,
        })
        .select()
        .single();

      if (productError || !newProduct) {
        throw new Error(productError?.message || "No se pudo duplicar el producto");
      }

      // 4. Insertar la receta de insumos si existe
      if (originalSupplies && originalSupplies.length > 0) {
        const suppliesToInsert = originalSupplies.map((s) => ({
          product_id: newProduct.id,
          supply_id: s.supply_id,
          quantity: s.quantity,
        }));
        const { error: insSuppErr } = await supabase
          .from("product_supplies")
          .insert(suppliesToInsert);

        if (insSuppErr) {
          console.error("Error al duplicar insumos:", insSuppErr);
        }
      }

      // 5. Insertar los precios por canal si existen
      if (originalPrices && originalPrices.length > 0) {
        const pricesToInsert = originalPrices.map((p) => ({
          product_id: newProduct.id,
          channel_name: p.channel_name,
          profit_margin_percent: p.profit_margin_percent,
          selling_price: p.selling_price,
        }));
        const { error: insPriceErr } = await supabase
          .from("product_prices")
          .insert(pricesToInsert);

        if (insPriceErr) {
          console.error("Error al duplicar precios:", insPriceErr);
        }
      }

      // 6. Recargar el listado
      await loadProducts();

      // 7. Expandir el nuevo producto y mostrar notificación
      setExpandedProductId(newProduct.id);
      setSuccessToast(`¡Producto duplicado como "${clonedName}"!`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } catch (err: any) {
      console.error("Error al duplicar producto:", err);
      alert("Error al duplicar el producto: " + (err.message || "Error desconocido"));
    } finally {
      setDuplicatingId(null);
    }
  };

  // Metadatos y conteos globales
  const productsWithMeta = useMemo(() => {
    return products.map((product) => {
      const meta = parseProductMeta(product.description);
      const badge = getCategoryBadge(meta.category);
      return {
        ...product,
        meta,
        badge,
      };
    });
  }, [products]);

  // Contadores para métricas y badges de filtro
  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let alerts = 0;
    const byCategory: Record<string, number> = {};

    productsWithMeta.forEach((p) => {
      if (p.meta.isActive) active++;
      else inactive++;

      if (p.needs_price_review) alerts++;

      const catKey = p.meta.category.toLowerCase();
      byCategory[catKey] = (byCategory[catKey] || 0) + 1;
    });

    return {
      total: productsWithMeta.length,
      active,
      inactive,
      alerts,
      byCategory,
    };
  }, [productsWithMeta]);

  // Categorías que tienen al menos un producto, o las predefinidas
  const activeCategories = useMemo(() => {
    return PRODUCT_CATEGORIES.map((cat) => ({
      ...cat,
      count:
        counts.byCategory[cat.id.toLowerCase()] ||
        counts.byCategory[cat.label.toLowerCase()] ||
        0,
    }));
  }, [counts.byCategory]);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return productsWithMeta.filter((p) => {
      // 1. Búsqueda por texto (nombre, categoría, descripción limpia)
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchDesc = p.meta.cleanDescription.toLowerCase().includes(query);
        const matchCat = p.meta.category.toLowerCase().includes(query);
        if (!matchName && !matchDesc && !matchCat) return false;
      }

      // 2. Filtro por categoría
      if (selectedCategory !== "all") {
        const selectedObj = PRODUCT_CATEGORIES.find((c) => c.id === selectedCategory);
        const matchCat =
          p.meta.category.toLowerCase() === selectedCategory.toLowerCase() ||
          (selectedObj && p.meta.category.toLowerCase() === selectedObj.label.toLowerCase());
        if (!matchCat) return false;
      }

      // 3. Filtro por estado
      if (statusFilter === "active" && !p.meta.isActive) return false;
      if (statusFilter === "inactive" && p.meta.isActive) return false;

      // 4. Filtro por alerta de costo desactualizado
      if (onlyAlerts && !p.needs_price_review) return false;

      return true;
    });
  }, [productsWithMeta, search, selectedCategory, statusFilter, onlyAlerts]);

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedCategory !== "all" ||
    statusFilter !== "all" ||
    onlyAlerts;

  const resetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setStatusFilter("all");
    setOnlyAlerts(false);
  };

  return (
    <div className="w-full flex flex-col space-y-4 pb-16">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <span>Mis Productos</span>
            <span className="text-xs bg-[#DCF4D7] text-[#1F7A4C] font-semibold px-2.5 py-0.5 rounded-full border border-[#C3EBC0]">
              {products.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-500">
            Catálogo artesanal, badges de estado y cálculo de costos en tiempo real
          </p>
        </div>
        <Link
          href="/productos/nuevo"
          className="p-2.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Crear</span>
        </Link>
      </div>

      {/* KPI Cards Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-2.5 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center">
          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
            Total
          </span>
          <span className="text-base font-black text-neutral-800">{counts.total}</span>
          <span className="text-[9px] text-neutral-400">en catálogo</span>
        </div>

        <div className="bg-white rounded-2xl p-2.5 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center">
          <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Activos
          </span>
          <span className="text-base font-black text-emerald-700">{counts.active}</span>
          <span className="text-[9px] text-emerald-600/80">a la venta</span>
        </div>

        <button
          onClick={() => setOnlyAlerts(!onlyAlerts)}
          className={`rounded-2xl p-2.5 border shadow-sm flex flex-col items-center text-center transition cursor-pointer ${
            onlyAlerts
              ? "bg-amber-100 border-amber-300 ring-2 ring-amber-400"
              : counts.alerts > 0
              ? "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70"
              : "bg-white border-[#EAF0E8]"
          }`}
        >
          <span className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Alertas
          </span>
          <span className="text-base font-black text-amber-800">{counts.alerts}</span>
          <span className="text-[9px] text-amber-700">
            {counts.alerts > 0 ? "revisar costo" : "al día"}
          </span>
        </button>
      </div>

      {/* Buscador reactivo */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, categoría o detalle..."
          className="w-full pl-10 pr-10 py-2.5 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none shadow-sm transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtros de Categoría (Scroll horizontal de chips) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
            selectedCategory === "all"
              ? "bg-[#1F7A4C] text-white shadow-sm"
              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
          }`}
        >
          <span>✨ Todas</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedCategory === "all" ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {counts.total}
          </span>
        </button>

        {activeCategories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(isSelected ? "all" : cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 border ${
                isSelected
                  ? "bg-[#3BB578] text-white border-[#3BB578] shadow-sm"
                  : "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label.split("&")[0].split("/")[0].trim()}</span>
              {cat.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? "bg-white/25 text-white" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros Secundarios: Estado (Todos / Activos / Inactivos) + Alerta */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        {/* Píldoras de estado */}
        <div className="p-1 bg-neutral-100 rounded-2xl flex text-xs font-semibold">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-xl transition ${
              statusFilter === "all"
                ? "bg-white text-[#1F7A4C] shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1 rounded-xl transition flex items-center gap-1 ${
              statusFilter === "active"
                ? "bg-white text-emerald-700 shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Activos</span>
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1 rounded-xl transition flex items-center gap-1 ${
              statusFilter === "inactive"
                ? "bg-white text-neutral-800 shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
            <span>Inactivos</span>
          </button>
        </div>

        {/* Chip toggle de alertas y botón de limpiar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOnlyAlerts(!onlyAlerts)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 border ${
              onlyAlerts
                ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                : counts.alerts > 0
                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                : "bg-white text-neutral-400 border-neutral-200"
            }`}
            title="Filtrar solo productos que requieran revisión de costo"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Alerta Costo</span>
            {counts.alerts > 0 && (
              <span
                className={`text-[9px] px-1 rounded-full font-black ${
                  onlyAlerts ? "bg-white text-amber-800" : "bg-amber-200 text-amber-900"
                }`}
              >
                {counts.alerts}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="p-1 text-neutral-400 hover:text-rose-600 rounded-lg transition"
              title="Limpiar todos los filtros"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tip Didáctico HABA */}
      <div className="bg-[#F0FAF4] border border-[#DCF4D7] p-3 rounded-2xl flex items-start gap-2.5">
        <div className="w-6 h-6 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="text-[11px] leading-snug text-[#2B2B2B]">
          <span className="font-bold text-[#1F7A4C] block mb-0.5">
            💡 Badges de estado y alertas de precios en tu taller
          </span>
          Los productos con el badge <strong className="text-amber-700">⚠️ Revisar Precios</strong> indican que alguno de sus insumos subió de precio recientemente. Podés activar o pausar cualquier producto haciendo clic en su badge de estado.
        </div>
      </div>

      {/* Listado de Productos o Estado Vacío */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
          <HabaMascot size={60} className="animate-bounce" />
          <p className="text-xs text-neutral-400">Cargando tu catálogo de productos...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              {hasActiveFilters ? "No se encontraron productos con estos filtros" : "Todavía no creaste productos"}
            </h3>
            <p className="text-xs text-neutral-500 max-w-[260px] mt-1">
              {hasActiveFilters
                ? "Probá cambiando la categoría, el estado o limpiá la búsqueda."
                : "Combiná tus insumos, asigná tu tiempo de mano de obra y fijá precios para feria, mayorista u online."}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={resetFilters}
              className="mt-2 py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-2xl transition"
            >
              Restablecer filtros
            </button>
          ) : (
            <Link
              href="/productos/nuevo"
              className="mt-2 py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Crear mi primer producto</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const isExpanded = expandedProductId === product.id;
            const retailPrice =
              product.product_prices?.find((p) =>
                p.channel_name.toLowerCase().includes("minorista")
              ) || product.product_prices?.[0];

            const isActive = product.meta.isActive;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-3xl p-4 border shadow-sm flex flex-col space-y-3 transition-all ${
                  isActive
                    ? "border-[#EAF0E8] hover:border-[#C3EBC0]"
                    : "border-neutral-200/80 bg-neutral-50/40 opacity-90"
                }`}
              >
                {/* Cabecera de la tarjeta con Avatar temático de Categoría y Badges */}
                <div className="flex items-start justify-between gap-3">
                  {/* Avatar de Categoría Artesanal (Sin foto) */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border shadow-xs transition transform hover:scale-105"
                    style={{
                      backgroundColor: product.badge.bgColor,
                      borderColor: product.badge.color + "33",
                    }}
                    title={`Categoría: ${product.meta.category}`}
                  >
                    <span>{product.meta.categoryIcon}</span>
                  </div>

                  {/* Información Principal y Badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {/* Badge 1: Categoría */}
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                        style={{
                          backgroundColor: product.badge.bgColor,
                          color: product.badge.color,
                          borderColor: product.badge.color + "40",
                        }}
                      >
                        <span>{product.badge.icon}</span>
                        <span className="truncate max-w-[130px]">{product.badge.label}</span>
                      </span>

                      {/* Badge 2: Estado Activo / Inactivo (Interactivo con toggle) */}
                      <button
                        onClick={() => handleToggleStatus(product, isActive)}
                        disabled={togglingId === product.id}
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border transition active:scale-95 cursor-pointer ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200"
                        }`}
                        title={
                          isActive
                            ? "Producto activo. Clic para pausar."
                            : "Producto inactivo. Clic para activar."
                        }
                      >
                        {isActive ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex rounded-full h-2 w-2 bg-neutral-400"></span>
                            <span>Inactivo</span>
                          </>
                        )}
                      </button>

                      {/* Badge 3: Alerta de Costo Desactualizado */}
                      {product.needs_price_review && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Revisar Precios</span>
                        </span>
                      )}
                    </div>

                    {/* Nombre del producto */}
                    <h3
                      className={`text-sm font-bold truncate ${
                        isActive ? "text-neutral-800" : "text-neutral-500 line-through decoration-neutral-300"
                      }`}
                    >
                      {product.name}
                    </h3>

                    {/* Descripción limpia si existe */}
                    {product.meta.cleanDescription && (
                      <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                        {product.meta.cleanDescription}
                      </p>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="flex items-center gap-0.5">
                    {/* Botón de alternar estado rápido */}
                    <button
                      onClick={() => handleToggleStatus(product, isActive)}
                      disabled={togglingId === product.id}
                      className={`p-1.5 rounded-xl transition ${
                        isActive
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-neutral-400 hover:text-emerald-600 hover:bg-neutral-100"
                      }`}
                      title={isActive ? "Pausar producto" : "Activar producto"}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    {/* Botón de duplicar producto */}
                    <button
                      onClick={() => handleDuplicate(product)}
                      disabled={duplicatingId === product.id}
                      className="p-1.5 text-neutral-400 hover:text-[#1F7A4C] hover:bg-[#DCF4D7] rounded-xl transition disabled:opacity-50"
                      title="Duplicar producto (receta y precios)"
                    >
                      {duplicatingId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#3BB578]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* Botón de crear presupuesto desde producto */}
                    <Link
                      href={`/presupuestos/nuevo?productId=${product.id}`}
                      className="p-1.5 text-neutral-400 hover:text-[#1F7A4C] hover:bg-[#DCF4D7] rounded-xl transition"
                      title="Crear presupuesto con este producto"
                    >
                      <Receipt className="w-4 h-4" />
                    </Link>

                    {/* Botón de eliminar */}
                    <button
                      onClick={() => handleDelete(product)}
                      className="p-1.5 text-neutral-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Botón de desplegar acordeón */}
                    <button
                      onClick={() =>
                        setExpandedProductId(isExpanded ? null : product.id)
                      }
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition"
                      title="Ver desglose de costos y canales"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Métricas Principales: Costo Total y Precio de Venta */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100">
                  <div className="bg-[#f6f9f6] p-2.5 rounded-2xl border border-[#EAF0E8]">
                    <span className="text-[10px] font-semibold text-neutral-500 block">
                      Costo Total
                    </span>
                    <span className="text-sm font-black text-[#1F7A4C]">
                      {formatCurrency(product.total_cost)}
                    </span>
                    <span className="text-[9px] block text-neutral-400 mt-0.5">
                      {product.include_labor
                        ? `${product.work_time_minutes} min M.O.`
                        : "Solo materiales"}
                    </span>
                  </div>

                  <div className="bg-[#DCF4D7] p-2.5 rounded-2xl border border-[#C3EBC0]">
                    <span className="text-[10px] font-bold text-[#1F7A4C] block truncate">
                      {retailPrice
                        ? retailPrice.channel_name.split("(")[0].trim()
                        : "Precio Sugerido"}
                    </span>
                    <span className="text-sm font-black text-[#1F7A4C]">
                      {retailPrice ? formatCurrency(retailPrice.selling_price) : "-"}
                    </span>
                    {retailPrice && (
                      <span className="text-[9px] block text-[#1F7A4C] mt-0.5 font-semibold">
                        Margen: {retailPrice.profit_margin_percent}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Alerta de precio integrada en la card si requiere revisión */}
                {product.needs_price_review && !isExpanded && (
                  <div className="bg-amber-50/80 border border-amber-200/80 p-2 rounded-xl flex items-center justify-between text-[10px] text-amber-800">
                    <span className="flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      Insumos aumentaron de precio
                    </span>
                    <button
                      onClick={() => setExpandedProductId(product.id)}
                      className="font-bold underline text-amber-900 hover:text-amber-700"
                    >
                      Ver detalle
                    </button>
                  </div>
                )}

                {/* Vista Desplegada: Desglose de Canales y Costos */}
                {isExpanded && (
                  <div className="pt-2 border-t border-neutral-100 space-y-2.5 animate-in fade-in-50 duration-200">
                    {/* Alerta explicativa expandida */}
                    {product.needs_price_review && (
                      <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Insumos con aumento detectado:</strong>
                          Uno o más insumos asignados a esta receta se actualizaron. Te recomendamos revisar las cantidades y confirmar tus precios de venta.
                        </div>
                      </div>
                    )}

                    {/* Desglose de costos */}
                    <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60 text-xs space-y-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Composición del Costo:
                      </span>
                      <div className="flex justify-between text-neutral-600">
                        <span>Materiales & Packaging:</span>
                        <span className="font-semibold">{formatCurrency(product.direct_cost)}</span>
                      </div>
                      {product.include_labor && (
                        <div className="flex justify-between text-neutral-600">
                          <span>Mano de obra ({product.work_time_minutes} min):</span>
                          <span className="font-semibold">{formatCurrency(product.labor_cost)}</span>
                        </div>
                      )}
                      {product.indirect_cost > 0 && (
                        <div className="flex justify-between text-neutral-600">
                          <span>Gastos fijos prorrateados:</span>
                          <span className="font-semibold">{formatCurrency(product.indirect_cost)}</span>
                        </div>
                      )}
                    </div>

                    {/* Desglose de Insumos y Materiales de la Receta */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-[#3BB578]" />
                          Insumos de la Receta:
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {product.product_supplies?.length || 0}{" "}
                          {product.product_supplies?.length === 1 ? "insumo" : "insumos"}
                        </span>
                      </div>

                      {product.product_supplies && product.product_supplies.length > 0 ? (
                        <div className="space-y-1.5">
                          {product.product_supplies.map((item) => {
                            const supply = item.supplies;
                            const unitCost = supply
                              ? calculateUnitCost(
                                  Number(supply.current_price || 0),
                                  Number(supply.purchase_quantity || 1),
                                  Number(supply.conversion_factor || 1)
                                )
                              : 0;
                            const subtotalCost = unitCost * Number(item.quantity || 0);

                            return (
                              <div
                                key={item.id}
                                className="p-2.5 bg-neutral-50/80 rounded-2xl border border-neutral-200/60 flex items-center justify-between text-xs hover:bg-neutral-50 transition"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-neutral-800 truncate">
                                      {supply?.name || "Insumo"}
                                    </span>
                                    {supply?.category && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-neutral-200/60 text-neutral-600">
                                        {supply.category === "packaging" ? "Packaging" : "Materia prima"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                                    {item.quantity} {supply?.use_unit || "u"} • {formatCurrency(unitCost)} /{supply?.use_unit || "u"}
                                  </span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="font-extrabold text-[#1F7A4C] text-xs block">
                                    {formatCurrency(subtotalCost)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-center text-xs text-neutral-400 italic">
                          Este producto no tiene insumos asignados en su receta.
                        </div>
                      )}
                    </div>

                    {/* Canales de Venta */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Precios por Canal de Venta:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {product.product_prices && product.product_prices.length > 0 ? (
                          product.product_prices.map((price) => {
                            const profit = price.selling_price - product.total_cost;
                            return (
                              <div
                                key={price.id}
                                className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-neutral-800 block">
                                    {price.channel_name}
                                  </span>
                                  <span className="text-[10px] text-[#1F7A4C] font-semibold">
                                    Margen {price.profit_margin_percent}% (+{formatCurrency(profit)})
                                  </span>
                                </div>
                                <span className="font-extrabold text-[#1F7A4C] text-sm">
                                  {formatCurrency(price.selling_price)}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-2 text-xs text-neutral-400 italic">
                            Sin canales de precio configurados
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción rápida en vista desplegada */}
                    <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <span className="text-[10px] text-neutral-400">
                        Acciones rápidas para este producto:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDuplicate(product)}
                          disabled={duplicatingId === product.id}
                          className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                          title="Crear una copia con la misma receta y precios"
                        >
                          {duplicatingId === product.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3BB578]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>Duplicar</span>
                        </button>

                        <Link
                          href={`/presupuestos/nuevo?productId=${product.id}`}
                          className="px-3 py-1.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                          title="Crear una cotización congelada con este producto"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Crear Presupuesto</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast de Notificación Kawaii */}
      {successToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1F7A4C] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-400/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-200 flex-shrink-0" />
          <span>{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="ml-2 text-emerald-200 hover:text-white p-0.5 rounded-lg transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
