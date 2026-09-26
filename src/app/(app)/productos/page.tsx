"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  Pencil,
  Boxes,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
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
  wouldCreateCircularDependency,
  validateProductYield,
  getAllProductCategories,
  detectModifiedSupplies,
  ModifiedSupplyInfo,
  isDuplicateProductName,
  checkProductNameExists,
  isCategoryMatch,
  getCategoryId,
  normalizeCategoryString,
} from "@/lib/products";
import { matchesSearch } from "@/lib/search";
import { SupplyModal, SupplyItem } from "@/components/SupplyModal";
import { CategorySelector } from "@/components/CategorySelector";
import { PriceReviewModal } from "@/components/products/PriceReviewModal";
import {
  ProductPricingChannels,
  ChannelPriceItem,
} from "@/components/products/ProductPricingChannels";
import { ProductYieldCard } from "@/components/products/ProductYieldCard";

interface ProductPrice {
  id: string;
  channel_name: string;
  profit_margin_percent: number;
  selling_price: number;
}

export interface ProductSupplyItem {
  id: string;
  quantity: number;
  supply_id?: string;
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
  yield?: number;
  direct_cost: number;
  labor_cost: number;
  indirect_cost: number;
  total_cost: number;
  needs_price_review: boolean;
  created_at: string;
  product_prices?: ProductPrice[];
  product_supplies?: ProductSupplyItem[];
  product_components?: {
    id: string;
    quantity: number;
    component_product_id: string;
    component?: {
      id: string;
      name: string;
      description?: string | null;
      direct_cost: number;
      total_cost: number;
    } | null;
  }[];
}

export interface CatalogSupply {
  id: string;
  name: string;
  category?: string;
  current_price: number;
  use_unit?: string;
  purchase_unit?: string;
  purchase_quantity?: number;
  conversion_factor?: number;
}

export interface EditSupplyLine {
  id?: string;
  supply_id: string;
  name: string;
  use_unit: string;
  unit_cost: number;
  quantity: number | string;
}

export interface EditComponentLine {
  id?: string;
  component_product_id: string;
  name: string;
  unit_cost: number;
  quantity: number | string;
}

export type EditPriceLine = ChannelPriceItem;

export default function ProductosPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [currentMinuteRate, setCurrentMinuteRate] = useState<number>(0);

  // Insumos disponibles en el catálogo para editar recetas
  const [allSupplies, setAllSupplies] = useState<CatalogSupply[]>([]);
  const [editSupplies, setEditSupplies] = useState<EditSupplyLine[]>([]);
  const [selectedSupplyToAdd, setSelectedSupplyToAdd] = useState<string>("");

  // Subproductos componentes en edición
  const [editComponents, setEditComponents] = useState<EditComponentLine[]>([]);
  const [selectedComponentToAdd, setSelectedComponentToAdd] = useState<string>("");
  const [editRecipeTab, setEditRecipeTab] = useState<"supplies" | "components">("supplies");

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);

  // Acordeón desplegado
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Modal para duplicar con nombre personalizado
  const [duplicateModalProduct, setDuplicateModalProduct] = useState<Product | null>(null);
  const [duplicateNewName, setDuplicateNewName] = useState("");

  // Modal para editar producto (nombre, descripción, minutos, categoría e insumos)
  const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editWorkMinutes, setEditWorkMinutes] = useState<number | string>(0);
  const [editYield, setEditYield] = useState<number | string>(1);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isCreateSupplyOpen, setIsCreateSupplyOpen] = useState(false);
  const [editPrices, setEditPrices] = useState<EditPriceLine[]>([]);

  // Historial de precios de insumos para detección explícita de aumentos
  const [priceHistory, setPriceHistory] = useState<
    Array<{ id?: string; supply_id: string; price: number; changed_at: string }>
  >([]);

  // Modal de revisión detallada de precios por insumos
  const [reviewPriceProduct, setReviewPriceProduct] = useState<any | null>(null);

  // Alertas de precios omitidas / descartadas por el usuario en la sesión
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("haba_dismissed_price_alerts");
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  // Mapeo de todas las relaciones existentes para prevención de ciclos
  const allRelations = useMemo(() => {
    const rels: { parent_product_id: string; component_product_id: string }[] = [];
    for (const p of products) {
      if (p.product_components) {
        for (const c of p.product_components) {
          rels.push({
            parent_product_id: p.id,
            component_product_id: c.component_product_id,
          });
        }
      }
    }
    return rels;
  }, [products]);

  // Cargar productos con sus precios asociados, recetas de insumos y subproductos
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, suppliesRes, priceHistoryRes] = await Promise.all([
        supabase
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
                conversion_factor,
                updated_at
              )
            ),
            product_components!parent_product_id (
              id,
              quantity,
              component_product_id,
              component:products!component_product_id (
                id,
                name,
                description,
                direct_cost,
                total_cost
              )
            )
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("supplies")
          .select("id, name, category, current_price, use_unit, purchase_unit, purchase_quantity, conversion_factor, updated_at")
          .order("name", { ascending: true }),
        supabase
          .from("supply_price_history")
          .select("id, supply_id, price, changed_at")
          .order("changed_at", { ascending: false }),
      ]);

      if (suppliesRes.data) {
        setAllSupplies(suppliesRes.data as CatalogSupply[]);
      }

      if (priceHistoryRes.data) {
        setPriceHistory(priceHistoryRes.data);
      }

      if (!productsRes.error && productsRes.data) {
        setProducts(productsRes.data as Product[]);
      } else if (productsRes.error) {
        // Fallback en caso de que product_components aún no esté creada en Supabase
        const fallbackRes = await supabase
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
                conversion_factor,
                updated_at
              )
            )
          `)
          .order("created_at", { ascending: false });
        if (fallbackRes.data) {
          setProducts(fallbackRes.data as Product[]);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: laborData } = await supabase
          .from("labor_settings")
          .select("minute_rate")
          .eq("user_id", user.id)
          .single();
        if (laborData?.minute_rate) {
          setCurrentMinuteRate(laborData.minute_rate);
        }
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
      // 0. Verificar si este producto está siendo utilizado como subproducto en otros productos activos
      try {
        const { data: parentRelations } = await supabase
          .from("product_components")
          .select("parent_product_id, parent:products!parent_product_id (id, name)")
          .eq("component_product_id", product.id);

        if (parentRelations && parentRelations.length > 0) {
          const parentNames = parentRelations
            .map((r: any) => r.parent?.name || "Producto padre")
            .filter(Boolean)
            .join(", ");
          alert(
            `No podés eliminar "${product.name}" porque actualmente forma parte de la receta de: ${parentNames}.\n\nQuitalo primero de esos productos para poder eliminarlo.`
          );
          return;
        }
      } catch {
        // ignore if table not created
      }

      // 1. Eliminar relaciones primero
      try {
        await supabase.from("product_components").delete().eq("parent_product_id", product.id);
      } catch {}
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

  // Abrir modal de duplicación para pedir nombre distinto (Punto I)
  const handleDuplicate = (product: Product) => {
    setDuplicateModalProduct(product);
    setDuplicateNewName(`${product.name} (copia)`);
  };

  // Confirmar duplicación con nombre validado
  const handleConfirmDuplicate = async () => {
    if (!duplicateModalProduct || duplicatingId) return;
    const finalName = duplicateNewName.trim();
    if (!finalName) {
      alert("Por favor ingresá un nombre para la copia del producto.");
      return;
    }
    if (isDuplicateProductName(finalName, products)) {
      alert("Ya existe un producto con este nombre. Elige un nombre diferente.");
      return;
    }

    try {
      setDuplicatingId(duplicateModalProduct.id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sesión no válida");

      // Doble verificación en base de datos
      const nameExistsInDb = await checkProductNameExists(supabase, finalName);
      if (nameExistsInDb) {
        alert("Ya existe un producto con este nombre. Elige un nombre diferente.");
        setDuplicatingId(null);
        return;
      }

      // 1. Obtener los insumos de la receta original
      const { data: originalSupplies, error: suppliesFetchErr } = await supabase
        .from("product_supplies")
        .select("supply_id, quantity")
        .eq("product_id", duplicateModalProduct.id);

      if (suppliesFetchErr) {
        console.error("Error al obtener insumos:", suppliesFetchErr);
      }

      // 2. Obtener los precios de canales originales
      const { data: originalPrices, error: pricesFetchErr } = await supabase
        .from("product_prices")
        .select("channel_name, profit_margin_percent, selling_price")
        .eq("product_id", duplicateModalProduct.id);

      if (pricesFetchErr) {
        console.error("Error al obtener precios:", pricesFetchErr);
      }

      // 3. Insertar el nuevo producto en la tabla products
      const nowIso = new Date().toISOString();
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: finalName,
          description: duplicateModalProduct.description,
          work_time_minutes: duplicateModalProduct.work_time_minutes,
          include_labor: duplicateModalProduct.include_labor,
          direct_cost: duplicateModalProduct.direct_cost,
          labor_cost: duplicateModalProduct.labor_cost,
          indirect_cost: duplicateModalProduct.indirect_cost,
          total_cost: duplicateModalProduct.total_cost,
          needs_price_review: false,
          created_at: nowIso,
          updated_at: nowIso,
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

      // 4.b. Duplicar subproductos componentes si existen
      const originalComponents = duplicateModalProduct.product_components;
      if (originalComponents && originalComponents.length > 0) {
        try {
          const componentsToInsert = originalComponents.map((c) => ({
            parent_product_id: newProduct.id,
            component_product_id: c.component_product_id,
            quantity: c.quantity,
          }));
          await supabase.from("product_components").insert(componentsToInsert);
        } catch (compErr) {
          console.warn("No se pudieron duplicar componentes:", compErr);
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

      // Cerrar modal
      setDuplicateModalProduct(null);

      // 6. Recargar el listado
      await loadProducts();

      // 7. Expandir el nuevo producto y mostrar notificación
      setExpandedProductId(newProduct.id);
      setSuccessToast(`¡Producto duplicado como "${finalName}"!`);
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

  // Abrir modal de edición de producto con receta e insumos (Punto 5)
  const handleOpenEdit = (product: Product) => {
    const meta = parseProductMeta(product.description);
    setEditModalProduct(product);
    setEditName(product.name);
    setEditDescription(meta.cleanDescription || "");
    setEditCategory(meta.category || "");
    setEditWorkMinutes(product.work_time_minutes || 0);
    setEditYield(meta.yield || 1);

    // Cargar insumos actuales de la receta
    const initialSupplies: EditSupplyLine[] = (product.product_supplies || []).map((ps) => {
      const s = ps.supplies;
      const unitCost = s
        ? calculateUnitCost(s.current_price, s.purchase_quantity || 1, s.conversion_factor || 1)
        : 0;
      return {
        id: ps.id,
        supply_id: ps.supply_id || s?.id || "",
        name: s?.name || "Insumo",
        use_unit: s?.use_unit || "u",
        unit_cost: unitCost,
        quantity: ps.quantity || 1,
      };
    });
    setEditSupplies(initialSupplies);
    setSelectedSupplyToAdd("");

    // Cargar subproductos componentes actuales
    const initialComponents: EditComponentLine[] = (product.product_components || []).map((pc) => {
      const c = pc.component;
      const unitCost = c ? (Number(c.total_cost) || Number(c.direct_cost) || 0) : 0;
      return {
        id: pc.id,
        component_product_id: pc.component_product_id || c?.id || "",
        name: c?.name || "Subproducto",
        unit_cost: unitCost,
        quantity: pc.quantity || 1,
      };
    });
    setEditComponents(initialComponents);
    setSelectedComponentToAdd("");
    setEditRecipeTab("supplies");

    // Cargar precios por canal actuales para edición
    const loadedPrices = (product.product_prices || []).map((p) => ({
      id: p.id,
      channel_name: p.channel_name,
      profit_margin_percent: p.profit_margin_percent ?? 0,
      selling_price: p.selling_price ?? 0,
    }));

    if (loadedPrices.length === 0) {
      const baseCost = Number(product.total_cost) || Number(product.direct_cost) || 0;
      setEditPrices([
        {
          id: `custom-${Date.now()}-1`,
          channel_name: "Por Menor",
          profit_margin_percent: 100,
          selling_price: Math.round(baseCost * 2),
        },
      ]);
    } else {
      setEditPrices(loadedPrices);
    }
  };

  // Agregar insumo a la receta en edición
  const handleAddSupplyToRecipe = (supplyId: string) => {
    if (!supplyId) return;
    const supply = allSupplies.find((s) => s.id === supplyId);
    if (!supply) return;
    if (editSupplies.some((es) => es.supply_id === supplyId)) {
      alert("Este insumo ya está agregado al producto.");
      return;
    }
    const unitCost = calculateUnitCost(
      supply.current_price,
      supply.purchase_quantity || 1,
      supply.conversion_factor || 1
    );
    setEditSupplies((prev) => [
      ...prev,
      {
        supply_id: supply.id,
        name: supply.name,
        use_unit: supply.use_unit || "u",
        unit_cost: unitCost,
        quantity: 1,
      },
    ]);
    setSelectedSupplyToAdd("");
  };

  // Crear insumo al vuelo dentro del modal de edición
  const handleSupplyCreatedInlineEdit = (createdSupply?: SupplyItem) => {
    setIsCreateSupplyOpen(false);
    if (createdSupply) {
      const catalogItem: CatalogSupply = {
        id: createdSupply.id!,
        name: createdSupply.name,
        category: createdSupply.category,
        current_price: createdSupply.current_price,
        use_unit: createdSupply.use_unit,
        purchase_unit: createdSupply.purchase_unit,
        purchase_quantity: createdSupply.purchase_quantity,
        conversion_factor: createdSupply.conversion_factor,
      };
      setAllSupplies((prev) =>
        [catalogItem, ...prev.filter((s) => s.id !== catalogItem.id)].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      const unitCost = calculateUnitCost(
        createdSupply.current_price,
        createdSupply.purchase_quantity || 1,
        createdSupply.conversion_factor || 1
      );
      setEditSupplies((prev) => [
        ...prev,
        {
          supply_id: createdSupply.id!,
          name: createdSupply.name,
          use_unit: createdSupply.use_unit || "u",
          unit_cost: unitCost,
          quantity: 1,
        },
      ]);
      setSuccessToast(`¡Insumo "${createdSupply.name}" creado y agregado al producto!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  // Quitar insumo de la receta
  const handleRemoveSupplyFromRecipe = (index: number) => {
    setEditSupplies((prev) => prev.filter((_, i) => i !== index));
  };

  // Actualizar cantidad de insumo en edición
  const handleUpdateEditSupplyQty = (index: number, qty: number | string) => {
    setEditSupplies((prev) => {
      const updated = [...prev];
      updated[index].quantity = qty;
      return updated;
    });
  };

  // Agregar subproducto a la receta en edición
  const handleAddComponentToRecipe = (compProductId: string) => {
    if (!compProductId || !editModalProduct) return;
    const prod = products.find((p) => p.id === compProductId);
    if (!prod) return;
    if (editComponents.some((ec) => ec.component_product_id === compProductId)) {
      alert("Este subproducto ya está agregado a este producto.");
      return;
    }
    const baseCost = Number(prod.total_cost) || Number(prod.direct_cost) || 0;
    setEditComponents((prev) => [
      ...prev,
      {
        component_product_id: prod.id,
        name: prod.name,
        unit_cost: baseCost,
        quantity: 1,
      },
    ]);
    setSelectedComponentToAdd("");
  };

  // Quitar subproducto de la receta en edición
  const handleRemoveComponentFromRecipe = (index: number) => {
    setEditComponents((prev) => prev.filter((_, i) => i !== index));
  };

  // Actualizar cantidad de subproducto en edición
  const handleUpdateEditComponentQty = (index: number, qty: number | string) => {
    setEditComponents((prev) => {
      const updated = [...prev];
      updated[index].quantity = qty;
      return updated;
    });
  };

  // Costos reactivos del modal de edición por Lote y Unitarios
  const editSuppliesCost = useMemo(() => {
    return editSupplies.reduce((acc, curr) => {
      const qty = typeof curr.quantity === "number" ? curr.quantity : parseFloat(String(curr.quantity)) || 0;
      return acc + curr.unit_cost * qty;
    }, 0);
  }, [editSupplies]);

  const editComponentsCost = useMemo(() => {
    return editComponents.reduce((acc, curr) => {
      const qty = typeof curr.quantity === "number" ? curr.quantity : parseFloat(String(curr.quantity)) || 0;
      return acc + curr.unit_cost * qty;
    }, 0);
  }, [editComponents]);

  const editBatchDirectCost = editSuppliesCost + editComponentsCost;
  const editMins = typeof editWorkMinutes === "number" ? editWorkMinutes : parseFloat(String(editWorkMinutes)) || 0;
  const editBatchLaborCost = editMins > 0 ? Math.round(editMins * (currentMinuteRate || 0) * 100) / 100 : 0;
  const editBatchTotalCost = Math.round((editBatchDirectCost + editBatchLaborCost) * 100) / 100;

  const safeEditYield = useMemo(() => {
    const y = typeof editYield === "number" ? editYield : parseFloat(String(editYield)) || 1;
    return y > 0 ? y : 1;
  }, [editYield]);

  const editUnitDirectCost = Math.round((editBatchDirectCost / safeEditYield) * 100) / 100;
  const editUnitLaborCost = Math.round((editBatchLaborCost / safeEditYield) * 100) / 100;
  const editUnitTotalCost = Math.round((editBatchTotalCost / safeEditYield) * 100) / 100;

  const editDirectCost = editUnitDirectCost;
  const editLaborCost = editUnitLaborCost;
  const editTotalCost = editUnitTotalCost;

  // Guardar cambios del modal de edición incluyendo insumos y receta
  const handleSaveEditProduct = async () => {
    if (!editModalProduct || savingEdit) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      alert("El nombre del producto es obligatorio.");
      return;
    }

    if (isDuplicateProductName(trimmedName, products, editModalProduct.id)) {
      alert("Ya existe un producto con este nombre. Elige un nombre diferente.");
      return;
    }

    const yieldValidation = validateProductYield(editYield);
    if (!yieldValidation.isValid) {
      alert(yieldValidation.error || "El rendimiento debe ser un número mayor a 0.");
      return;
    }

    try {
      setSavingEdit(true);

      // Doble verificación en base de datos
      const nameExistsInDb = await checkProductNameExists(supabase, trimmedName, editModalProduct.id);
      if (nameExistsInDb) {
        alert("Ya existe un producto con este nombre. Elige un nombre diferente.");
        setSavingEdit(false);
        return;
      }

      const meta = parseProductMeta(editModalProduct.description);
      const newDescription = serializeProductDescription({
        cleanDescription: editDescription.trim(),
        category: editCategory || meta.category,
        isActive: meta.isActive,
        yieldValue: yieldValidation.value,
      });

      const nowIso = new Date().toISOString();

      // 1. Actualizar tabla products
      const { error: prodErr } = await supabase
        .from("products")
        .update({
          name: editName.trim(),
          description: newDescription,
          work_time_minutes: editMins,
          direct_cost: editDirectCost,
          labor_cost: editLaborCost,
          indirect_cost: 0,
          total_cost: editTotalCost,
          needs_price_review: false,
          updated_at: nowIso,
        })
        .eq("id", editModalProduct.id);

      if (prodErr) throw prodErr;

      // 2. Reemplazar insumos de la receta en product_supplies
      await supabase.from("product_supplies").delete().eq("product_id", editModalProduct.id);

      if (editSupplies.length > 0) {
        const suppliesToInsert = editSupplies.map((s) => {
          const qty = typeof s.quantity === "number" ? s.quantity : parseFloat(String(s.quantity)) || 0;
          return {
            product_id: editModalProduct.id,
            supply_id: s.supply_id,
            quantity: qty,
          };
        });
        const { error: insSuppliesErr } = await supabase.from("product_supplies").insert(suppliesToInsert);
        if (insSuppliesErr) {
          console.error("Error updating product supplies:", insSuppliesErr);
        }
      }

      // 2.b. Reemplazar subproductos componentes en product_components
      try {
        await supabase.from("product_components").delete().eq("parent_product_id", editModalProduct.id);
        if (editComponents.length > 0) {
          const componentsToInsert = editComponents.map((c) => {
            const qty = typeof c.quantity === "number" ? c.quantity : parseFloat(String(c.quantity)) || 1;
            return {
              parent_product_id: editModalProduct.id,
              component_product_id: c.component_product_id,
              quantity: qty,
            };
          });
          const { error: insCompErr } = await supabase.from("product_components").insert(componentsToInsert);
          if (insCompErr) {
            console.warn("Aviso actualizando subproductos:", insCompErr);
          }
        }
      } catch (errComp) {
        console.warn("Error con product_components:", errComp);
      }

      // 3. Actualizar precios por canal en product_prices
      if (editPrices.length === 0) {
        alert("Debes mantener al menos un canal de venta activo para el producto.");
        setSavingEdit(false);
        return;
      }

      // Obtener los IDs originales de precios que tenía el producto en BD
      const originalPriceIds = (editModalProduct.product_prices || [])
        .map((p) => p.id)
        .filter(Boolean);

      // Identificar los IDs existentes que se conservaron en la edición
      const keptPriceIds = new Set(
        editPrices
          .map((p) => p.id)
          .filter((id): id is string => Boolean(id && !id.startsWith("custom-") && !id.startsWith("new-")))
      );

      // Eliminar de BD los canales que el usuario removió
      const removedPriceIds = originalPriceIds.filter((id) => !keptPriceIds.has(id));
      if (removedPriceIds.length > 0) {
        const { error: delErr } = await supabase
          .from("product_prices")
          .delete()
          .in("id", removedPriceIds);
        if (delErr) {
          console.error("Error al eliminar canales de precio removidos:", delErr);
          throw new Error("Error al remover canales obsoletos: " + delErr.message);
        }
      }

      // Actualizar canales existentes o insertar canales nuevos
      for (const price of editPrices) {
        const finalMargin =
          typeof price.profit_margin_percent === "number"
            ? price.profit_margin_percent
            : parseFloat(String(price.profit_margin_percent)) || 0;
        let finalSelling =
          typeof price.selling_price === "number"
            ? price.selling_price
            : parseFloat(String(price.selling_price)) || 0;
        
        // Si el precio de venta quedó vacío o en 0 pero tiene margen, calcular según costo unitario
        if (finalSelling === 0 && finalMargin > 0) {
          finalSelling = Math.round(editTotalCost * (1 + finalMargin / 100));
        }

        const channelName = (price.channel_name || "").trim() || "General";

        const isExisting = price.id && !price.id.startsWith("custom-") && !price.id.startsWith("new-");
        if (isExisting) {
          const { error: updateErr } = await supabase
            .from("product_prices")
            .update({
              channel_name: channelName,
              profit_margin_percent: finalMargin,
              selling_price: finalSelling,
            })
            .eq("id", price.id);
          if (updateErr) {
            console.error("Error al actualizar canal de precio:", updateErr);
            throw new Error(`Error al actualizar canal "${channelName}": ` + updateErr.message);
          }
        } else {
          const { error: insertErr } = await supabase
            .from("product_prices")
            .insert({
              product_id: editModalProduct.id,
              channel_name: channelName,
              profit_margin_percent: finalMargin,
              selling_price: finalSelling,
            });
          if (insertErr) {
            console.error("Error al insertar nuevo canal de precio:", insertErr);
            throw new Error(`Error al agregar canal "${channelName}": ` + insertErr.message);
          }
        }
      }

      setDismissedAlerts((prev) => {
        if (!prev.has(editModalProduct.id)) return prev;
        const next = new Set(prev);
        next.delete(editModalProduct.id);
        try {
          sessionStorage.setItem("haba_dismissed_price_alerts", JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      setEditModalProduct(null);
      await loadProducts();
      setSuccessToast(`¡Producto "${editName.trim()}" actualizado correctamente con sus precios e insumos!`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } catch (err: any) {
      console.error("Error al actualizar producto:", err);
      alert("No se pudo actualizar el producto: " + (err.message || "Error"));
    } finally {
      setSavingEdit(false);
    }
  };

  // Recalcular costos y actualizar precios de canales
  const handleRecalculate = async (product: typeof productsWithMeta[0]) => {
    if (recalculatingId) return;
    try {
      setRecalculatingId(product.id);

      const nowIso = new Date().toISOString();
      const newDirectCost = Math.round(product.currentMaterialsCost * 100) / 100;
      const newLaborCost = Math.round((product.work_time_minutes || 0) * currentMinuteRate * 100) / 100;
      const newTotalCost = Math.round((newDirectCost + newLaborCost) * 100) / 100;

      // 1. Actualizar producto en Supabase
      const { error: prodErr } = await supabase
        .from("products")
        .update({
          direct_cost: newDirectCost,
          labor_cost: newLaborCost,
          indirect_cost: 0,
          total_cost: newTotalCost,
          needs_price_review: false,
          updated_at: nowIso,
        })
        .eq("id", product.id);

      if (prodErr) throw prodErr;

      // 2. Actualizar precios de canales manteniendo el margen %
      const updatedPrices: ProductPrice[] = [];
      if (product.product_prices && product.product_prices.length > 0) {
        for (const price of product.product_prices) {
          const newSellingPrice = Math.round(newTotalCost * (1 + (price.profit_margin_percent || 0) / 100));
          await supabase
            .from("product_prices")
            .update({ selling_price: newSellingPrice })
            .eq("id", price.id);

          updatedPrices.push({
            ...price,
            selling_price: newSellingPrice,
          });
        }
      }

      // 3. Actualizar estado local inmediatamente
      setDismissedAlerts((prev) => {
        if (!prev.has(product.id)) return prev;
        const next = new Set(prev);
        next.delete(product.id);
        try {
          sessionStorage.setItem("haba_dismissed_price_alerts", JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== product.id) return p;
          return {
            ...p,
            direct_cost: newDirectCost,
            labor_cost: newLaborCost,
            indirect_cost: 0,
            total_cost: newTotalCost,
            needs_price_review: false,
            updated_at: nowIso,
            product_prices: updatedPrices.length > 0 ? updatedPrices : p.product_prices,
          };
        })
      );

      setSuccessToast(`¡Costos y precios recalculados para "${product.name}"!`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } catch (err: any) {
      console.error("Error al recalcular costos:", err);
      alert("No se pudo recalcular el producto: " + (err.message || "Error"));
    } finally {
      setRecalculatingId(null);
    }
  };

  // Omitir o descartar la alerta de modificación de precios
  const handleDismissAlert = async (product: any) => {
    try {
      setDismissedAlerts((prev) => {
        const next = new Set(prev);
        next.add(product.id);
        try {
          sessionStorage.setItem("haba_dismissed_price_alerts", JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      if (product.needs_price_review) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("products")
          .update({ needs_price_review: false, updated_at: nowIso })
          .eq("id", product.id);

        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, needs_price_review: false, updated_at: nowIso } : p))
        );
      }

      setSuccessToast(`Alerta de precios descartada para "${product.name}".`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      console.error("Error al descartar alerta:", err);
    }
  };

  // Metadatos, costos vigentes y detección reactiva de alerta con insumos modificados
  const productsWithMeta = useMemo(() => {
    return products.map((product) => {
      const meta = parseProductMeta(product.description);
      const badge = getCategoryBadge(meta.category);

      let currentMaterialsCost = 0;
      let hasRecipe = false;

      // 1. Insumos directos
      if (product.product_supplies && product.product_supplies.length > 0) {
        hasRecipe = true;
        currentMaterialsCost += product.product_supplies.reduce((acc, ps) => {
          if (!ps.supplies) return acc;
          const unitCost = calculateUnitCost(
            ps.supplies.current_price,
            ps.supplies.purchase_quantity || 1,
            ps.supplies.conversion_factor || 1
          );
          return acc + unitCost * (ps.quantity || 0);
        }, 0);
      }

      // 2. Subproductos componentes
      if (product.product_components && product.product_components.length > 0) {
        hasRecipe = true;
        currentMaterialsCost += product.product_components.reduce((acc, pc) => {
          if (!pc.component) return acc;
          const compCost = Number(pc.component.total_cost) || Number(pc.component.direct_cost) || 0;
          return acc + compCost * Number(pc.quantity || 0);
        }, 0);
      }

      const productYield = meta.yield > 0 ? meta.yield : 1;
      const unitMaterialsCost = hasRecipe ? currentMaterialsCost / productYield : Number(product.direct_cost || 0);
      const roundedUnitMaterialsCost = Math.round(unitMaterialsCost * 100) / 100;
      const savedDirectCost = Math.round(Number(product.direct_cost || 0) * 100) / 100;

      const costDifference = hasRecipe ? Math.abs(roundedUnitMaterialsCost - savedDirectCost) : 0;
      const isDismissed = dismissedAlerts.has(product.id);
      const modifiedSupplies = detectModifiedSupplies(product, priceHistory);
      const hasModifiedSupplies = modifiedSupplies.length > 0;

      const isCostOutdated = !isDismissed && Boolean(
        product.needs_price_review ||
        hasModifiedSupplies ||
        (hasRecipe && costDifference > 0.05)
      );

      return {
        ...product,
        meta,
        badge,
        currentMaterialsCost: hasRecipe ? roundedUnitMaterialsCost : savedDirectCost,
        isCostOutdated,
        modifiedSupplies,
      };
    });
  }, [products, priceHistory, dismissedAlerts]);

  // Insumos modificados para el producto actualmente en edición
  const editModalModifiedSupplies = useMemo(() => {
    if (!editModalProduct) return [];
    return detectModifiedSupplies(editModalProduct, priceHistory);
  }, [editModalProduct, priceHistory]);

  // Detección reactiva de nombre duplicado en edición
  const isDuplicateEditName = useMemo(() => {
    if (!editModalProduct) return false;
    return isDuplicateProductName(editName, products, editModalProduct.id);
  }, [editName, products, editModalProduct]);

  // Detección reactiva de nombre duplicado en duplicación
  const isDuplicateDuplicateName = useMemo(() => {
    if (!duplicateModalProduct) return false;
    return isDuplicateProductName(duplicateNewName, products);
  }, [duplicateNewName, products, duplicateModalProduct]);

  // Contadores para métricas y badges de filtro
  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let alerts = 0;
    const byCategory: Record<string, number> = {};

    productsWithMeta.forEach((p) => {
      if (p.meta.isActive) active++;
      else inactive++;

      if (p.isCostOutdated) alerts++;

      const catLabel = p.meta.category || "Otro";
      const catId = getCategoryId(catLabel);
      const normLabel = normalizeCategoryString(catLabel);

      byCategory[catId] = (byCategory[catId] || 0) + 1;
      if (normLabel && normLabel !== catId) {
        byCategory[normLabel] = (byCategory[normLabel] || 0) + 1;
      }
    });

    return {
      total: productsWithMeta.length,
      active,
      inactive,
      alerts,
      byCategory,
    };
  }, [productsWithMeta]);

  // Categorías que tienen al menos un producto, o las predefinidas y personalizadas
  const activeCategories = useMemo(() => {
    const allCats = getAllProductCategories(products);
    return allCats.map((cat) => {
      const catId = cat.id;
      const normLabel = normalizeCategoryString(cat.label);
      const count = counts.byCategory[catId] || counts.byCategory[normLabel] || 0;
      return {
        ...cat,
        count,
      };
    });
  }, [counts.byCategory, products]);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return productsWithMeta.filter((p) => {
      // 1. Búsqueda por texto (nombre, categoría, descripción limpia) con normalización de acentos y mayúsculas
      if (search.trim()) {
        const match = matchesSearch(
          [p.name, p.meta.cleanDescription, p.meta.category],
          search
        );
        if (!match) return false;
      }

      // 2. Filtro por categoría (normalizado, insensible a acentos, IDs deterministas vs Etiquetas)
      if (selectedCategory !== "all") {
        const matchCat = isCategoryMatch(p.meta.category, selectedCategory, activeCategories);
        if (!matchCat) return false;
      }

      // 3. Filtro por estado
      if (statusFilter === "active" && !p.meta.isActive) return false;
      if (statusFilter === "inactive" && p.meta.isActive) return false;

      // 4. Filtro por alerta de costo desactualizado
      if (onlyAlerts && !p.isCostOutdated) return false;

      return true;
    });
  }, [productsWithMeta, search, selectedCategory, statusFilter, onlyAlerts, activeCategories]);

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
            Catálogo artesanal, etiquetas de estado y cálculo de costos en tiempo real
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
            type="button"
            onClick={() => setSearch("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 transition"
            title="Borrar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtros de Categoría (Scroll horizontal de chips) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
        <button
          onClick={() => {
            setSelectedCategory("all");
            setSearch("");
          }}
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
              onClick={() => {
                setSelectedCategory(isSelected ? "all" : cat.id);
                setSearch("");
              }}
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

      {/* Tip Didáctico HABA (Punto I) */}
      <div className="bg-[#F0FAF4] border border-[#DCF4D7] p-3 rounded-2xl flex items-start gap-2.5">
        <div className="w-6 h-6 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="text-[11px] leading-snug text-[#2B2B2B]">
          <span className="font-bold text-[#1F7A4C] block mb-0.5">
            💡 Etiquetas de estado y alertas de precios en tu taller
          </span>
          Los productos con la etiqueta <strong className="text-amber-700">⚠️ Revisar Precios</strong> indican que alguno de sus insumos subió de precio recientemente. Podés activar o pausar cualquier producto haciendo clic en su etiqueta de estado.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                className={`bg-white rounded-3xl p-4 border shadow-sm flex flex-col space-y-3 transition-all cursor-pointer ${
                  isActive
                    ? "border-[#EAF0E8] hover:border-[#3BB578]/50 hover:shadow-md"
                    : "border-neutral-200/80 bg-neutral-50/40 opacity-90 hover:border-neutral-300 hover:shadow-md"
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedProductId(isExpanded ? null : product.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                {/* Cabecera de la tarjeta: Título a la izquierda, botones de acción a la derecha */}
                <div className="flex items-start justify-between gap-2">
                  {/* Información Principal y Badges */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {/* Badge 1: Categoría */}
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs"
                        style={{
                          backgroundColor: product.badge.bgColor,
                          color: product.badge.color,
                          borderColor: product.badge.color + "40",
                        }}
                      >
                        <span>{product.badge.icon}</span>
                        <span className="truncate max-w-[120px]">{product.badge.label}</span>
                      </span>

                      {/* Badge 2: Estado Activo / Inactivo (Interactivo con toggle) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(product, isActive);
                        }}
                        disabled={togglingId === product.id}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition active:scale-95 cursor-pointer ${
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

                      {/* Etiqueta 3: Alerta de Costo Desactualizado */}
                      {product.isCostOutdated && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Revisar Precios</span>
                        </span>
                      )}
                    </div>

                    {/* Nombre del producto */}
                    <h3
                      className={`text-sm font-bold break-words leading-tight ${
                        isActive ? "text-neutral-800" : "text-neutral-500 line-through decoration-neutral-300"
                      }`}
                    >
                      {product.name}
                    </h3>

                    {/* Descripción limpia si existe */}
                    {product.meta.cleanDescription && (
                      <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1 leading-snug">
                        {product.meta.cleanDescription}
                      </p>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="flex items-center gap-0.5">
                    {/* Botón de alternar estado rápido */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(product, isActive);
                      }}
                      disabled={togglingId === product.id}
                      className={`p-1.5 rounded-xl transition cursor-pointer ${
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(product);
                      }}
                      disabled={duplicatingId === product.id}
                      className="p-1.5 text-neutral-400 hover:text-[#1F7A4C] hover:bg-[#DCF4D7] rounded-xl transition disabled:opacity-50 cursor-pointer"
                      title="Duplicar producto (receta y precios)"
                    >
                      {duplicatingId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#3BB578]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* Botón de editar producto (Punto H) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(product);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-[#1F7A4C] hover:bg-[#DCF4D7] rounded-xl transition cursor-pointer"
                      title="Editar detalles del producto"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Botón de crear presupuesto desde producto */}
                    <Link
                      href={`/presupuestos/nuevo?productId=${product.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-neutral-400 hover:text-[#1F7A4C] hover:bg-[#DCF4D7] rounded-xl transition"
                      title="Crear presupuesto con este producto"
                    >
                      <Receipt className="w-4 h-4" />
                    </Link>

                    {/* Botón de eliminar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(product);
                      }}
                      className="p-1.5 text-neutral-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Botón de desplegar acordeón */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedProductId(isExpanded ? null : product.id);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition cursor-pointer"
                      title={isExpanded ? "Ocultar detalles" : "Ver detalles y componentes"}
                      aria-label={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-[#1F7A4C]" : ""
                        }`}
                      />
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
                        ? `${product.work_time_minutes} min productivo`
                        : "Solo insumos"}
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

                {/* Alerta de precio integrada en la card con botón Recalcular, Ver detalle y Omitir */}
                {product.isCostOutdated && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-amber-50/90 border border-amber-200 p-2.5 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-2xs gap-2 cursor-default"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="text-[11px] font-semibold leading-tight truncate">
                        {product.modifiedSupplies && product.modifiedSupplies.length > 0
                          ? product.modifiedSupplies.length === 1
                            ? `${product.modifiedSupplies[0].name} aumentó de precio`
                            : `${product.modifiedSupplies.length} insumos aumentaron de precio`
                          : "Insumos cambiaron de precio"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewPriceProduct(product);
                        }}
                        className="py-1 px-2.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Ver desglose detallado de insumos modificados"
                      >
                        <TrendingUp className="w-3 h-3 text-amber-700" />
                        <span>Ver detalle</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecalculate(product);
                        }}
                        disabled={recalculatingId === product.id}
                        className="py-1 px-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition shadow-xs flex-shrink-0 disabled:opacity-50 cursor-pointer"
                        title="Actualizar costo directo, total y precios sugeridos"
                      >
                        <RefreshCw className={`w-3 h-3 ${recalculatingId === product.id ? "animate-spin" : ""}`} />
                        <span>{recalculatingId === product.id ? "..." : "Recalcular"}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissAlert(product);
                        }}
                        className="p-1 text-amber-700 hover:text-neutral-700 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                        title="Omitir alerta por ahora"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Vista Desplegada: Desglose de Canales y Costos */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 border-t border-neutral-100 space-y-2.5 animate-in fade-in-50 duration-200 cursor-default"
                  >
                    {/* Alerta explicativa expandida con comparador y botón */}
                    {product.isCostOutdated && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-2.5 text-xs text-amber-900">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <strong className="block font-bold">
                                Insumos con variación de precio detectada:
                              </strong>
                              <span className="text-[11px] text-amber-800">
                                {product.modifiedSupplies && product.modifiedSupplies.length > 0
                                  ? `Se detectaron cambios en ${product.modifiedSupplies.length} ${
                                      product.modifiedSupplies.length === 1 ? "insumo" : "insumos"
                                    } de la receta.`
                                  : "Uno o más insumos asignados a esta receta cambiaron de precio desde la última actualización."}
                              </span>
                            </div>
                          </div>
                          {product.modifiedSupplies && product.modifiedSupplies.length > 0 && (
                            <button
                              onClick={() => setReviewPriceProduct(product)}
                              className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline underline-offset-2 flex items-center gap-1 flex-shrink-0 cursor-pointer"
                            >
                              <span>Ver simulación</span>
                              <TrendingUp className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Desglose de insumos modificados */}
                        {product.modifiedSupplies && product.modifiedSupplies.length > 0 && (
                          <div className="space-y-1.5 pt-0.5">
                            {product.modifiedSupplies.map((mod: ModifiedSupplyInfo) => (
                              <div
                                key={mod.supplyId}
                                className="bg-white/90 p-2 rounded-xl border border-amber-200 flex items-center justify-between gap-2 text-[11px]"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-neutral-900 truncate">
                                      {mod.name}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                        mod.isIncrease
                                          ? "bg-amber-100 text-amber-800 border-amber-300"
                                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      }`}
                                    >
                                      {mod.isIncrease ? "+" : ""}
                                      {formatCurrency(mod.priceDiff)} ({mod.isIncrease ? "+" : ""}
                                      {mod.percentChange}%)
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 mt-0.5">
                                    {formatCurrency(mod.prevPrice)} → {formatCurrency(mod.newPrice)} / {mod.purchaseUnit} • Usa: {mod.quantity} {mod.useUnit}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="text-[10px] text-neutral-400 block">Impacto en costo:</span>
                                  <span className="font-bold text-amber-900 text-xs">
                                    {mod.isIncrease ? "+" : ""}
                                    {formatCurrency(mod.costImpact)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between bg-white/80 p-2 rounded-xl border border-amber-200/60 text-[11px]">
                          <span>Costo materiales guardado: <strong>{formatCurrency(product.direct_cost)}</strong></span>
                          <span>➔</span>
                          <span>Costo actual vigente: <strong className="text-amber-800">{formatCurrency(product.currentMaterialsCost)}</strong></span>
                        </div>

                        <div className="flex items-center justify-between pt-1 gap-2">
                          <button
                            type="button"
                            onClick={() => handleDismissAlert(product)}
                            className="py-1.5 px-3 rounded-xl border border-amber-300 hover:bg-amber-100/70 text-amber-900 text-xs font-semibold transition cursor-pointer"
                            title="Descartar esta alerta"
                          >
                            Omitir alerta
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReviewPriceProduct(product)}
                              className="py-1.5 px-3 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              Ver detalle completo
                            </button>
                            <button
                              onClick={() => handleRecalculate(product)}
                              disabled={recalculatingId === product.id}
                              className="py-1.5 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${recalculatingId === product.id ? "animate-spin" : ""}`} />
                              <span>{recalculatingId === product.id ? "Recalculando..." : "Recalcular Costos y Precios"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Desglose de costos */}
                    <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60 text-xs space-y-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Composición del Costo:
                      </span>
                      <div className="flex justify-between text-neutral-600">
                        <span>Total Insumos & Componentes:</span>
                        <span className="font-semibold">{formatCurrency(product.direct_cost)}</span>
                      </div>
                      {product.include_labor && (
                        <>
                          <div className="flex justify-between text-neutral-600">
                            <span>Costo productivo ({product.work_time_minutes} min):</span>
                            <span className="font-semibold">{formatCurrency(product.labor_cost)}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 -mt-0.5">
                            Incluye gastos operativos + sueldo
                          </div>
                        </>
                      )}
                    </div>

                    {/* Insumos y Packaging que lo componen (Única sección consolidada) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-[#3BB578]" />
                          Insumos y Packaging:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-400 font-medium">
                            {product.product_supplies?.length || 0}{" "}
                            {product.product_supplies?.length === 1 ? "insumo" : "insumos"}
                          </span>
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="text-[11px] font-bold text-[#1F7A4C] hover:text-[#165837] flex items-center gap-1 transition ml-1"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>

                      {product.product_supplies && product.product_supplies.length > 0 ? (
                        <div className="space-y-1.5">
                          {product.product_supplies.map((item) => {
                            const supply = item.supplies;
                            const modInfo = product.modifiedSupplies?.find(
                              (m: ModifiedSupplyInfo) => m.supplyId === item.supply_id
                            );
                            const isModified = Boolean(modInfo);
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
                                className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs transition gap-2 ${
                                  isModified
                                    ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/50 hover:bg-amber-50"
                                    : "bg-neutral-50/80 border-neutral-200/60 hover:bg-neutral-50"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-neutral-800 break-words whitespace-normal">
                                      {supply?.name || "Insumo"}
                                    </span>
                                    {supply?.category && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-neutral-200/60 text-neutral-600 flex-shrink-0">
                                        {supply.category === "packaging" ? "Packaging" : "Materia prima"}
                                      </span>
                                    )}
                                    {isModified && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-300 flex-shrink-0">
                                        <TrendingUp className="w-2.5 h-2.5" />
                                        Aumentó {modInfo ? `(+${modInfo.percentChange}%)` : ""}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                                    {item.quantity} {supply?.use_unit || "u"} • {formatCurrency(unitCost)} /{supply?.use_unit || "u"}
                                    {isModified && modInfo && (
                                      <span className="text-amber-800 font-semibold ml-1">
                                        (antes {formatCurrency(modInfo.prevUnitCost)}/{modInfo.useUnit})
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="font-extrabold text-[#1F7A4C] text-xs block">
                                    {formatCurrency(subtotalCost)}
                                  </span>
                                  {isModified && modInfo && (
                                    <span className="text-[9.5px] font-bold text-amber-700 block">
                                      +{formatCurrency(modInfo.costImpact)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-center text-xs text-neutral-400 italic">
                          Este producto no tiene insumos asignados.
                        </div>
                      )}
                    </div>

                    {/* Desglose de Subproductos / Componentes de la Receta */}
                    {product.product_components && product.product_components.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-[#3BB578]" />
                            Subproductos Componentes:
                          </span>
                          <span className="text-[10px] text-neutral-400 font-medium">
                            {product.product_components.length}{" "}
                            {product.product_components.length === 1 ? "subproducto" : "subproductos"}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {product.product_components.map((item) => {
                            const comp = item.component;
                            const unitCost = comp ? (Number(comp.total_cost) || Number(comp.direct_cost) || 0) : 0;
                            const subtotalCost = unitCost * Number(item.quantity || 0);

                            return (
                              <div
                                key={item.id}
                                className="p-2.5 bg-neutral-50/80 rounded-2xl border border-neutral-200/60 flex items-center justify-between text-xs hover:bg-neutral-50 transition"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-neutral-800 truncate">
                                      {comp?.name || "Subproducto"}
                                    </span>
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#DCF4D7] text-[#1F7A4C]">
                                      Subproducto
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                                    {item.quantity} u • {formatCurrency(unitCost)} / u (costo base)
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
                      </div>
                    )}

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

      {/* Modal para Duplicar Producto solicitando nuevo nombre (Punto I) */}
      {duplicateModalProduct && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100dvh",
            minHeight: "100vh",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDuplicateModalProduct(null);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] space-y-4 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-[#3BB578]" />
                <span>Duplicar Producto</span>
              </h3>
              <button
                onClick={() => setDuplicateModalProduct(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Para evitar productos duplicados con el mismo nombre, ingresá un nombre diferente para esta copia (ej: variante, color o tamaño):
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-700 block">
                Nombre de la copia:
              </label>
              <input
                type="text"
                value={duplicateNewName}
                onChange={(e) => setDuplicateNewName(e.target.value)}
                placeholder="Ej: Cuaderno A5 Rayado"
                className={`w-full px-3 py-2 text-xs bg-neutral-50 border rounded-2xl outline-none focus:bg-white transition ${
                  isDuplicateDuplicateName
                    ? "border-rose-300 ring-2 ring-rose-100 bg-rose-50/20"
                    : "border-neutral-200 focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7]"
                }`}
                autoFocus
              />
              {isDuplicateDuplicateName && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Ya existe un producto con este nombre. Elige un nombre diferente.</span>
                </p>
              )}
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                Original: {duplicateModalProduct.name}
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDuplicateModalProduct(null)}
                className="py-2 px-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-semibold rounded-2xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicate}
                disabled={!duplicateNewName.trim() || isDuplicateDuplicateName || duplicatingId !== null}
                className="py-2 px-4 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {duplicatingId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Duplicando...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Confirmar Duplicación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal para Edición Rápida y Receta de Producto (Punto 5) */}
      {editModalProduct && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100dvh",
            minHeight: "100vh",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditModalProduct(null);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-lg md:max-w-4xl lg:max-w-5xl rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] flex flex-col animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 overflow-hidden"
            style={{
              height: "min(92vh, 760px)",
              maxHeight: "calc(100dvh - env(safe-area-inset-top, 20px) - 10px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 flex-shrink-0">
              <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2 font-display">
                <Pencil className="w-4 h-4 text-[#3BB578]" />
                <span>Editar Producto</span>
              </h3>
              <button
                onClick={() => setEditModalProduct(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="overflow-y-auto pr-1 py-3 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Columna Izquierda: Información básica y Receta */}
                <div className="space-y-4">
                  {/* Nombre del Producto */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Nombre del Producto: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs bg-neutral-50 border rounded-2xl outline-none focus:bg-white transition ${
                    isDuplicateEditName
                      ? "border-rose-300 ring-2 ring-rose-100 bg-rose-50/20"
                      : "border-neutral-200 focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7]"
                  }`}
                />
                {isDuplicateEditName && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Ya existe un producto con este nombre. Elige un nombre diferente.</span>
                  </p>
                )}
              </div>

              {/* Categoría y Tiempo de producción */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Categoría:
                  </label>
                  <CategorySelector
                    value={editCategory}
                    onChange={(newCat) => setEditCategory(newCat)}
                    existingProducts={products}
                    supabase={supabase}
                    onCategoriesChanged={loadProducts}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Tiempo de producción:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={editWorkMinutes === 0 || editWorkMinutes === "" ? "" : editWorkMinutes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditWorkMinutes(val === "" ? "" : Math.max(0, parseFloat(val) || 0));
                      }}
                      placeholder="0 min (opcional)"
                      className="w-28 px-2.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl text-center font-bold outline-none focus:bg-white focus:border-[#3BB578]"
                    />
                    <span className="text-xs text-neutral-400">min</span>
                    {Number(editWorkMinutes) >= 60 && (
                      <span className="text-[10px] text-[#1F7A4C] bg-[#DCF4D7] px-1.5 py-0.5 rounded-md font-semibold">
                        ~{(Number(editWorkMinutes) / 60).toFixed(1)} hs
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Descripción o Notas:
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detalles, medidas o variantes..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:bg-white focus:border-[#3BB578] resize-none"
                />
              </div>

              {/* SECCIÓN DE INSUMOS Y SUBPRODUCTOS EN EDICIÓN */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex rounded-xl bg-neutral-200/60 p-0.5 gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditRecipeTab("supplies")}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        editRecipeTab === "supplies"
                          ? "bg-white text-[#1F7A4C] shadow-2xs"
                          : "text-neutral-500 hover:text-neutral-700"
                      }`}
                    >
                      <Boxes className="w-3.5 h-3.5 text-[#3BB578]" />
                      <span>Insumos ({editSupplies.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditRecipeTab("components")}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        editRecipeTab === "components"
                          ? "bg-white text-[#1F7A4C] shadow-2xs"
                          : "text-neutral-500 hover:text-neutral-700"
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 text-[#3BB578]" />
                      <span>Subproductos ({editComponents.length})</span>
                    </button>
                  </div>
                  <div className="ml-auto text-right flex-shrink-0">
                    <span className="text-xs font-bold text-[#1F7A4C] bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-100/80 whitespace-nowrap inline-block shadow-2xs">
                      Materiales: {formatCurrency(editDirectCost)}
                    </span>
                  </div>
                </div>

                {/* CONTENIDO PESTAÑA INSUMOS EN EDICIÓN */}
                {editRecipeTab === "supplies" && (
                  <div className="space-y-2.5">
                    {/* Selector para agregar insumo del catálogo */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/60">
                      <select
                        value={selectedSupplyToAdd}
                        onChange={(e) => setSelectedSupplyToAdd(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                      >
                        <option value="">+ Seleccionar insumo para agregar...</option>
                        {allSupplies
                          .filter((s) => !editSupplies.some((es) => es.supply_id === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.category === "packaging" ? "📦 Packaging" : "🧵 Materia"}) - {formatCurrency(s.current_price)}/{s.purchase_unit || "u"}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddSupplyToRecipe(selectedSupplyToAdd)}
                        disabled={!selectedSupplyToAdd}
                        className="px-3 py-1.5 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs flex-shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreateSupplyOpen(true)}
                        className="px-2.5 py-1.5 bg-[#DCF4D7] hover:bg-[#cbf0c4] text-[#1F7A4C] border border-[#C3EBC0] text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs flex-shrink-0"
                        title="Crear nuevo insumo al vuelo"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Crear</span>
                      </button>
                    </div>

                    {/* Banner de aviso en edición si hay insumos con aumento */}
                    {editModalModifiedSupplies.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span className="text-[11px] leading-tight">
                          Hay {editModalModifiedSupplies.length}{" "}
                          {editModalModifiedSupplies.length === 1 ? "insumo con aumento detectado" : "insumos con aumento detectado"}. Al guardar se recalculará el costo directo con los valores vigentes.
                        </span>
                      </div>
                    )}

                    {/* Lista de insumos cargados */}
                    {editSupplies.length === 0 ? (
                      <p className="text-[11px] text-neutral-400 italic py-2 text-center bg-white rounded-xl border border-dashed border-neutral-200">
                        No hay insumos asignados a este producto. Elegí uno arriba para sumarlo.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {editSupplies.map((item, idx) => {
                          const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
                          const lineSubtotal = item.unit_cost * qty;
                          const modInfo = editModalModifiedSupplies.find(
                            (m) => m.supplyId === item.supply_id
                          );
                          const isModified = Boolean(modInfo);

                          return (
                            <div
                              key={item.supply_id || idx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                                isModified
                                  ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/40"
                                  : "bg-white border-neutral-200"
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-neutral-800 break-words whitespace-normal block">
                                    {item.name}
                                  </span>
                                  {isModified && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                                      <TrendingUp className="w-2.5 h-2.5" />
                                      Aumentó {modInfo ? `(+${modInfo.percentChange}%)` : ""}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-neutral-400 block mt-0.5">
                                  {formatCurrency(item.unit_cost)} / {item.use_unit}
                                  {isModified && modInfo && (
                                    <span className="text-amber-800 font-semibold ml-1">
                                      (antes {formatCurrency(modInfo.prevUnitCost)}/{modInfo.useUnit})
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.0001"
                                  value={item.quantity === 0 ? "" : item.quantity}
                                  onChange={(e) => handleUpdateEditSupplyQty(idx, e.target.value)}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-center font-bold outline-none focus:border-[#3BB578]"
                                />
                                <span className="text-[10.5px] text-neutral-500 font-semibold w-8">
                                  {item.use_unit}
                                </span>
                                <span className="text-xs font-bold text-[#1F7A4C] min-w-[65px] text-right">
                                  {formatCurrency(lineSubtotal)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSupplyFromRecipe(idx)}
                                  className="p-1 text-neutral-400 hover:text-rose-500 transition ml-1 cursor-pointer"
                                  title="Quitar insumo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENIDO PESTAÑA SUBPRODUCTOS EN EDICIÓN */}
                {editRecipeTab === "components" && (
                  <div className="space-y-2.5">
                    {/* Selector para agregar subproducto del catálogo */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/60">
                      <select
                        value={selectedComponentToAdd}
                        onChange={(e) => setSelectedComponentToAdd(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                      >
                        <option value="">+ Seleccionar subproducto registrado...</option>
                        {products
                          .filter((p) => {
                            if (p.id === editModalProduct?.id) return false;
                            if (editComponents.some((ec) => ec.component_product_id === p.id)) return false;
                            if (wouldCreateCircularDependency(editModalProduct?.id || "", p.id, allRelations)) return false;
                            return true;
                          })
                          .map((p) => {
                            const baseCost = Number(p.total_cost) || Number(p.direct_cost) || 0;
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} - Costo base: {formatCurrency(baseCost)}/u
                              </option>
                            );
                          })}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddComponentToRecipe(selectedComponentToAdd)}
                        disabled={!selectedComponentToAdd}
                        className="px-3 py-1.5 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                    </div>

                    {/* Lista de subproductos cargados */}
                    {editComponents.length === 0 ? (
                      <p className="text-[11px] text-neutral-400 italic py-2 text-center bg-white rounded-xl border border-dashed border-neutral-200">
                        No hay subproductos asignados a este producto. Elegí uno arriba para sumarlo a la lista de materiales.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {editComponents.map((item, idx) => {
                          const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
                          const lineSubtotal = item.unit_cost * qty;

                          return (
                            <div
                              key={item.component_product_id || idx}
                              className="bg-white p-2.5 rounded-xl border border-neutral-200 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-[#3BB578] flex-shrink-0" />
                                  <span className="font-bold text-neutral-800 break-words whitespace-normal block">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-neutral-400 block ml-5 mt-0.5">
                                  Costo base: {formatCurrency(item.unit_cost)} / u
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.0001"
                                  value={item.quantity === 0 ? "" : item.quantity}
                                  onChange={(e) => handleUpdateEditComponentQty(idx, e.target.value)}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-center font-bold outline-none focus:border-[#3BB578]"
                                />
                                <span className="text-[10.5px] text-neutral-500 font-semibold w-8">
                                  u
                                </span>
                                <span className="text-xs font-bold text-[#1F7A4C] min-w-[65px] text-right">
                                  {formatCurrency(lineSubtotal)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComponentFromRecipe(idx)}
                                  className="p-1 text-neutral-400 hover:text-rose-500 transition ml-1"
                                  title="Quitar subproducto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Rendimiento, Resumen de Costos y Canales de Venta */}
            <div className="space-y-4">
              {/* Tarjeta Unificada de Rendimiento del Lote y Resumen de Costos */}
              <ProductYieldCard
                yieldValue={editYield}
                onChangeYield={setEditYield}
                batchMaterialsCost={editBatchDirectCost}
                suppliesCost={editSuppliesCost}
                componentsCost={editComponentsCost}
                unitDirectCost={editUnitDirectCost}
                batchLaborCost={editBatchLaborCost}
                unitTotalCost={editTotalCost}
              />

              {/* SECCIÓN DE PRECIOS POR CANAL DE VENTA */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                <ProductPricingChannels
                  channels={editPrices}
                  onChange={setEditPrices}
                  unitCost={editTotalCost}
                  batchTotalCost={editBatchTotalCost}
                  yieldQuantity={safeEditYield}
                  title="Precios de Venta por Canal"
                  subtitle="Ajustá márgenes, precios o agregá nuevos canales"
                />
              </div>
            </div>
          </div>
        </div>

            {/* Footer con Acciones */}
            <div className="pt-3 flex justify-end gap-2 border-t border-neutral-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditModalProduct(null)}
                className="py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-semibold rounded-2xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditProduct}
                disabled={savingEdit || !editName.trim() || isDuplicateEditName}
                className="py-2 px-5 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal para crear insumos al vuelo desde edición */}
      <SupplyModal
        isOpen={isCreateSupplyOpen}
        onClose={() => setIsCreateSupplyOpen(false)}
        onSuccess={handleSupplyCreatedInlineEdit}
        zIndex="z-[100001]"
      />

      {/* Modal de Revisión Detallada de Precios por Modificación de Insumos */}
      <PriceReviewModal
        isOpen={reviewPriceProduct !== null}
        onClose={() => setReviewPriceProduct(null)}
        product={reviewPriceProduct}
        onRecalculate={handleRecalculate}
        onDismissAlert={handleDismissAlert}
        isRecalculating={recalculatingId === reviewPriceProduct?.id}
      />

      {/* Toast de Notificación Kawaii */}
      {successToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[60] bg-[#1F7A4C] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-400/30 animate-in fade-in slide-in-from-bottom-3 duration-200 w-max max-w-[calc(100vw-2rem)]"
          style={{
            bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
        >
          <Sparkles className="w-4 h-4 text-emerald-200 flex-shrink-0" />
          <span className="leading-tight">{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="ml-2 text-emerald-200 hover:text-white p-0.5 rounded-lg transition flex-shrink-0"
            aria-label="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
