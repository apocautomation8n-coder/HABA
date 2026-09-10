"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  ExternalLink,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";

interface ProductPrice {
  id: string;
  channel_name: string;
  profit_margin_percent: number;
  selling_price: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  work_time_minutes: number;
  include_labor: boolean;
  direct_cost: number;
  labor_cost: number;
  indirect_cost: number;
  total_cost: number;
  needs_price_review: boolean;
  created_at: string;
  product_prices?: ProductPrice[];
}

export default function ProductosPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Cargar productos con sus precios asociados
  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_prices (*)
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProducts(data as Product[]);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

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

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, search]);

  return (
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <span>Mis Productos</span>
            <span className="text-xs bg-[#DCF4D7] text-[#1F7A4C] font-semibold px-2 py-0.5 rounded-full">
              {products.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-500">Recetas, costos reales y precios multicanal</p>
        </div>
        <Link
          href="/productos/nuevo"
          className="p-2.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Crear</span>
        </Link>
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
          placeholder="Buscar por nombre o detalle..."
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none shadow-sm transition"
        />
      </div>

      {/* Listado de Productos o Estado Vacío */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Cargando tu catálogo de productos...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              {search ? "No se encontraron productos" : "Todavía no creaste productos"}
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              {search
                ? "Probá con otra búsqueda o limpiá el filtro."
                : "Combina tus insumos, asigná tu tiempo de mano de obra y fijá precios para feria, mayorista u online."}
            </p>
          </div>
          {!search && (
            <Link
              href="/productos/nuevo"
              className="mt-2 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm"
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
            const retailPrice = product.product_prices?.find((p) =>
              p.channel_name.toLowerCase().includes("minorista")
            ) || product.product_prices?.[0];

            return (
              <div
                key={product.id}
                className="bg-white rounded-3xl p-4 border border-[#EAF0E8] shadow-sm flex flex-col space-y-3 transition hover:border-[#C3EBC0]"
              >
                {/* Cabecera de la tarjeta del producto */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-neutral-800">{product.name}</h3>
                      {product.needs_price_review && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          Revisar Precios
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(product)}
                      className="p-1.5 text-neutral-300 hover:text-rose-500 rounded-xl transition"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setExpandedProductId(isExpanded ? null : product.id)
                      }
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl transition"
                      title="Ver desglose"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Métricas Principales */}
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
                    <span className="text-[10px] font-bold text-[#1F7A4C] block">
                      {retailPrice ? retailPrice.channel_name.split("(")[0].trim() : "Precio"}
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

                {/* Vista Desplegada: Desglose de Canales y Costos */}
                {isExpanded && (
                  <div className="pt-2 border-t border-neutral-100 space-y-2.5 animate-in fade-in-50 duration-200">
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

                    {/* Canales de Venta */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Precios por Canal:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {product.product_prices?.map((price) => {
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
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
