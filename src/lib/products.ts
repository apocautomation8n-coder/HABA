/**
 * Módulo de utilidades y constantes de Productos para HABA
 */

import { calculateUnitCost } from "./units";

export interface ProductCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: "papeleria", label: "Papelería & Libretas", icon: "📓", color: "#166534", bgColor: "#DCFCE7" },
  { id: "marroquineria", label: "Marroquinería & Cuero", icon: "👜", color: "#854D0E", bgColor: "#FEF9C3" },
  { id: "textil", label: "Textil & Costura", icon: "🧵", color: "#9D174D", bgColor: "#FCE7F3" },
  { id: "velas", label: "Velas & Aromas", icon: "🕯️", color: "#C2410C", bgColor: "#FFEDD5" },
  { id: "ceramica", label: "Cerámica & Deco", icon: "🏺", color: "#4338CA", bgColor: "#E0E7FF" },
  { id: "gastronomia", label: "Gastronomía / Pastelería", icon: "🧁", color: "#BE185D", bgColor: "#FCE7F3" },
  { id: "packaging", label: "Packaging & Cajas", icon: "📦", color: "#1F7A4C", bgColor: "#DCF4D7" },
  { id: "otro", label: "Otro", icon: "✨", color: "#374151", bgColor: "#F3F4F6" },
];

export interface ParsedProductMeta {
  category: string;
  categoryIcon: string;
  isActive: boolean;
  yield: number;
  cleanDescription: string;
}

/**
 * Parsea los metadatos estructurados dentro del campo description del producto
 */
export function parseProductMeta(rawDescription?: string | null): ParsedProductMeta {
  if (!rawDescription) {
    return {
      category: "Otro",
      categoryIcon: "✨",
      isActive: true,
      yield: 1,
      cleanDescription: "",
    };
  }

  let text = rawDescription;
  let categoryLabel = "Otro";
  let categoryIcon = "✨";
  let isActive = true;
  let yieldVal = 1;

  // 1. Extraer [Categoría: ...]
  const catMatch = text.match(/\[Categoría:\s*([^\]]+)\]/i);
  if (catMatch) {
    const rawCat = catMatch[1].trim();
    const matchedPreset = PRODUCT_CATEGORIES.find(
      (c) => c.id.toLowerCase() === rawCat.toLowerCase() || c.label.toLowerCase() === rawCat.toLowerCase()
    );

    if (matchedPreset) {
      categoryLabel = matchedPreset.label;
      categoryIcon = matchedPreset.icon;
    } else {
      categoryLabel = rawCat;
      categoryIcon = "✨";
    }
    text = text.replace(catMatch[0], "");
  }

  // 2. Extraer [Estado: Inactivo/Activo]
  const statusMatch = text.match(/\[Estado:\s*([^\]]+)\]/i);
  if (statusMatch) {
    const statusVal = statusMatch[1].trim().toLowerCase();
    if (statusVal === "inactivo" || statusVal === "pausado" || statusVal === "suspended") {
      isActive = false;
    } else {
      isActive = true;
    }
    text = text.replace(statusMatch[0], "");
  }

  // 3. Extraer [Rendimiento: ...]
  const yieldMatch = text.match(/\[Rendimiento:\s*([0-9]+(?:\.[0-9]+)?)\]/i);
  if (yieldMatch) {
    const parsed = parseFloat(yieldMatch[1]);
    if (!isNaN(parsed) && parsed > 0) {
      yieldVal = parsed;
    }
    text = text.replace(yieldMatch[0], "");
  }

  // 4. Limpiar cualquier tag residual de foto si existiese
  text = text.replace(/\[Foto:\s*[^\]]+\]/gi, "");

  return {
    category: categoryLabel,
    categoryIcon,
    isActive,
    yield: yieldVal,
    cleanDescription: text.trim(),
  };
}

/**
 * Serializa los metadatos estructurados junto a la descripción del producto para guardar en Supabase
 */
export function serializeProductDescription({
  cleanDescription,
  category,
  isActive = true,
  yieldValue = 1,
}: {
  cleanDescription?: string;
  category?: string;
  isActive?: boolean;
  yieldValue?: number;
}): string {
  const metaTags: string[] = [];

  if (category && category.trim()) {
    metaTags.push(`[Categoría: ${category.trim()}]`);
  }

  if (isActive === false) {
    metaTags.push(`[Estado: Inactivo]`);
  } else {
    metaTags.push(`[Estado: Activo]`);
  }

  const safeYield = typeof yieldValue === "number" ? yieldValue : parseFloat(String(yieldValue)) || 1;
  if (safeYield > 1) {
    metaTags.push(`[Rendimiento: ${safeYield}]`);
  }

  const clean = (cleanDescription || "").trim();
  if (metaTags.length > 0) {
    return clean ? `${metaTags.join(" ")}\n\n${clean}` : metaTags.join(" ");
  }

  return clean;
}

/**
 * Valida y normaliza el valor de rendimiento (yield / batch size).
 * Debe ser un número positivo > 0.
 */
export function validateProductYield(val: unknown): { isValid: boolean; value: number; error?: string } {
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num) || num <= 0) {
    return {
      isValid: false,
      value: 1,
      error: "El rendimiento debe ser un número mayor a 0 (ej. 1, 10, 24).",
    };
  }
  return {
    isValid: true,
    value: num,
  };
}

/**
 * Calcula los costos de lote y unitarios según el rendimiento.
 */
export function calculateBatchAndUnitCosts({
  suppliesCost,
  componentsCost,
  laborCost = 0,
  indirectCost = 0,
  yieldValue = 1,
}: {
  suppliesCost: number;
  componentsCost: number;
  laborCost?: number;
  indirectCost?: number;
  yieldValue?: number;
}) {
  const safeYield = yieldValue > 0 ? yieldValue : 1;
  const batchDirectCost = suppliesCost + componentsCost;
  const batchTotalCost = batchDirectCost + laborCost + indirectCost;

  const unitDirectCost = batchDirectCost / safeYield;
  const unitLaborCost = laborCost / safeYield;
  const unitIndirectCost = indirectCost / safeYield;
  const unitTotalCost = batchTotalCost / safeYield;

  return {
    batchDirectCost,
    batchLaborCost: laborCost,
    batchIndirectCost: indirectCost,
    batchTotalCost,
    unitDirectCost,
    unitLaborCost,
    unitIndirectCost,
    unitTotalCost,
    yield: safeYield,
  };
}

/**
 * Obtiene la información visual de una categoría
 */
export function getCategoryBadge(categoryStr?: string) {
  const matched = PRODUCT_CATEGORIES.find(
    (c) =>
      c.id.toLowerCase() === (categoryStr || "").toLowerCase() ||
      c.label.toLowerCase() === (categoryStr || "").toLowerCase()
  );

  if (matched) {
    return {
      label: matched.label,
      icon: matched.icon,
      color: matched.color,
      bgColor: matched.bgColor,
    };
  }

  const stored = getStoredCustomCategories();
  const matchedCustom = stored.find(
    (c) => c.label.toLowerCase() === (categoryStr || "").toLowerCase()
  );
  if (matchedCustom) {
    return {
      label: matchedCustom.label,
      icon: matchedCustom.icon || "🏷️",
      color: matchedCustom.color || "#1F7A4C",
      bgColor: matchedCustom.bgColor || "#DCF4D7",
    };
  }

  return {
    label: categoryStr || "Otro",
    icon: "✨",
    color: "#374151",
    bgColor: "#F3F4F6",
  };
}

export interface CustomCategoryItem {
  id: string;
  label: string;
  icon: string;
  color?: string;
  bgColor?: string;
  isCustom?: boolean;
}

const CUSTOM_CATEGORIES_STORAGE_KEY = "haba_custom_product_categories";

/**
 * Obtiene las categorías personalizadas guardadas en localStorage
 */
export function getStoredCustomCategories(): CustomCategoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Guarda las categorías personalizadas en localStorage
 */
export function saveStoredCustomCategories(cats: CustomCategoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(cats));
  } catch {
    // ignore
  }
}

/**
 * Obtiene la lista completa y unificada de categorías (presets + personalizadas + categorías de productos existentes)
 */
export function getAllProductCategories(existingProducts?: { description?: string | null }[]): CustomCategoryItem[] {
  const baseCategories: CustomCategoryItem[] = PRODUCT_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    icon: cat.icon,
    color: cat.color,
    bgColor: cat.bgColor,
    isCustom: false,
  }));

  const storedCustom = getStoredCustomCategories();
  const categoryMap = new Map<string, CustomCategoryItem>();

  for (const cat of baseCategories) {
    categoryMap.set(cat.label.toLowerCase(), cat);
  }

  for (const cat of storedCustom) {
    categoryMap.set(cat.label.toLowerCase(), { ...cat, isCustom: true });
  }

  // Extraer también cualquier categoría presente en los productos existentes
  if (existingProducts && Array.isArray(existingProducts)) {
    for (const p of existingProducts) {
      const meta = parseProductMeta(p.description);
      if (meta.category && meta.category.trim() && !categoryMap.has(meta.category.toLowerCase())) {
        const newCat: CustomCategoryItem = {
          id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: meta.category.trim(),
          icon: meta.categoryIcon || "🏷️",
          color: "#1F7A4C",
          bgColor: "#DCF4D7",
          isCustom: true,
        };
        categoryMap.set(meta.category.toLowerCase(), newCat);
      }
    }
  }

  return Array.from(categoryMap.values());
}

/**
 * Crea una nueva categoría personalizada
 */
export function createProductCategory(label: string, icon: string = "🏷️"): CustomCategoryItem {
  const trimmedLabel = label.trim();
  const existing = getStoredCustomCategories();
  const id = `custom-${Date.now()}`;
  const newCat: CustomCategoryItem = {
    id,
    label: trimmedLabel,
    icon: icon || "🏷️",
    color: "#1F7A4C",
    bgColor: "#DCF4D7",
    isCustom: true,
  };

  // Evitar duplicados por nombre
  const filtered = existing.filter((c) => c.label.toLowerCase() !== trimmedLabel.toLowerCase());
  const updated = [...filtered, newCat];
  saveStoredCustomCategories(updated);
  return newCat;
}

/**
 * Renombra una categoría personalizada y actualiza en Supabase todos los productos que la utilicen
 */
export async function updateProductCategory(
  oldLabel: string,
  newLabel: string,
  newIcon?: string,
  supabase?: any
): Promise<{ updatedCount: number }> {
  const trimmedOld = oldLabel.trim();
  const trimmedNew = newLabel.trim();
  if (!trimmedNew || trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) {
    return { updatedCount: 0 };
  }

  // 1. Actualizar en localStorage
  const stored = getStoredCustomCategories();
  const updatedStored = stored.map((cat) => {
    if (cat.label.toLowerCase() === trimmedOld.toLowerCase()) {
      return {
        ...cat,
        label: trimmedNew,
        icon: newIcon || cat.icon || "🏷️",
      };
    }
    return cat;
  });
  saveStoredCustomCategories(updatedStored);

  // 2. Actualizar productos en Supabase si se provee el cliente
  let updatedCount = 0;
  if (supabase) {
    try {
      const { data: products } = await supabase
        .from("products")
        .select("id, description");

      if (products && products.length > 0) {
        for (const prod of products) {
          const meta = parseProductMeta(prod.description);
          if (meta.category.toLowerCase() === trimmedOld.toLowerCase()) {
            const updatedDescription = serializeProductDescription({
              cleanDescription: meta.cleanDescription,
              category: trimmedNew,
              isActive: meta.isActive,
              yieldValue: meta.yield,
            });

            await supabase
              .from("products")
              .update({ description: updatedDescription })
              .eq("id", prod.id);

            updatedCount++;
          }
        }
      }
    } catch (err) {
      console.error("Error al actualizar productos tras renombrar categoría:", err);
    }
  }

  return { updatedCount };
}

/**
 * Elimina una categoría personalizada y reasigna los productos que la utilicen a 'Otro' en Supabase
 */
export async function deleteProductCategory(
  label: string,
  supabase?: any,
  reassignTo: string = "Otro"
): Promise<{ affectedCount: number }> {
  const trimmed = label.trim();

  // 1. Eliminar de localStorage
  const stored = getStoredCustomCategories();
  const updatedStored = stored.filter((c) => c.label.toLowerCase() !== trimmed.toLowerCase());
  saveStoredCustomCategories(updatedStored);

  // 2. Reasignar productos en Supabase si se provee el cliente
  let affectedCount = 0;
  if (supabase) {
    try {
      const { data: products } = await supabase
        .from("products")
        .select("id, description");

      if (products && products.length > 0) {
        for (const prod of products) {
          const meta = parseProductMeta(prod.description);
          if (meta.category.toLowerCase() === trimmed.toLowerCase()) {
            const updatedDescription = serializeProductDescription({
              cleanDescription: meta.cleanDescription,
              category: reassignTo,
              isActive: meta.isActive,
              yieldValue: meta.yield,
            });

            await supabase
              .from("products")
              .update({ description: updatedDescription })
              .eq("id", prod.id);

            affectedCount++;
          }
        }
      }
    } catch (err) {
      console.error("Error al reasignar productos tras eliminar categoría:", err);
    }
  }

  return { affectedCount };
}

/**
 * Consulta y calcula reactivamente cuántos productos del usuario tienen costos desactualizados
 * debido a que alguno de sus insumos cambió de precio o tienen needs_price_review = true.
 */
export async function getOutdatedProductsCount(supabase: any): Promise<number> {
  const items = await getOutdatedProductsList(supabase);
  return items.length;
}

export interface OutdatedProductAlert {
  id: string;
  name: string;
  direct_cost: number;
  currentMaterialsCost: number;
  difference: number;
}

export interface ProductComponentItem {
  id?: string;
  parent_product_id: string;
  component_product_id: string;
  quantity: number;
  created_at?: string;
  component?: {
    id: string;
    name: string;
    description?: string | null;
    direct_cost: number;
    labor_cost?: number;
    total_cost: number;
    needs_price_review?: boolean;
  } | null;
}

export interface SelectedProductComponent {
  component: {
    id: string;
    name: string;
    description?: string | null;
    direct_cost: number;
    total_cost: number;
  };
  quantity: number | string;
}

/**
 * Verifica si agregar candidateChildId a parentId generaría una referencia circular.
 * allRelations es un array de pares { parent_product_id, component_product_id }.
 */
export function wouldCreateCircularDependency(
  parentId: string,
  candidateChildId: string,
  allRelations: { parent_product_id: string; component_product_id: string }[]
): boolean {
  if (!parentId || !candidateChildId) return false;
  if (parentId === candidateChildId) return true;

  // BFS: Desde candidateChildId, verificar si alcanzamos parentId
  const visited = new Set<string>();
  const queue = [candidateChildId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === parentId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const rel of allRelations) {
      if (rel.parent_product_id === current && !visited.has(rel.component_product_id)) {
        queue.push(rel.component_product_id);
      }
    }
  }

  return false;
}

/**
 * Calcula la sumatoria del costo base aportado por los subproductos/componentes
 * Siempre toma estrictamente el costo base (total_cost o direct_cost), NO el precio de venta.
 */
export function calculateComponentsCost(components: SelectedProductComponent[]): number {
  if (!components || components.length === 0) return 0;
  return components.reduce((acc, item) => {
    const q = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
    const baseCost = Number(item.component.total_cost) || Number(item.component.direct_cost) || 0;
    return acc + baseCost * q;
  }, 0);
}

export async function getOutdatedProductsList(supabase: any): Promise<OutdatedProductAlert[]> {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        direct_cost,
        needs_price_review,
        product_supplies (
          id,
          quantity,
          supplies (
            id,
            name,
            current_price,
            purchase_quantity,
            conversion_factor
          )
        ),
        product_components!parent_product_id (
          id,
          quantity,
          component:products!component_product_id (
            id,
            name,
            direct_cost,
            total_cost,
            needs_price_review
          )
        )
      `);

    if (error || !products) {
      // Fallback si product_components aún no está creada en Supabase
      const { data: fallbackProducts } = await supabase
        .from("products")
        .select(`
          id,
          name,
          direct_cost,
          needs_price_review,
          product_supplies (
            id,
            quantity,
            supplies (
              id,
              name,
              current_price,
              purchase_quantity,
              conversion_factor
            )
          )
        `);
      if (!fallbackProducts) return [];
      return calculateOutdatedList(fallbackProducts);
    }

    return calculateOutdatedList(products);
  } catch (err) {
    console.error("Error al obtener lista de productos desactualizados:", err);
    return [];
  }
}

function calculateOutdatedList(products: any[]): OutdatedProductAlert[] {
  const outdatedProducts: OutdatedProductAlert[] = [];

  for (const product of products) {
    let currentMaterialsCost = 0;
    let hasRecipe = false;

    // 1. Costo de insumos directos
    if (product.product_supplies && product.product_supplies.length > 0) {
      hasRecipe = true;
      currentMaterialsCost += product.product_supplies.reduce((acc: number, ps: any) => {
        if (!ps.supplies) return acc;
        const purchaseQty = Number(ps.supplies.purchase_quantity) || 1;
        const factor = Number(ps.supplies.conversion_factor) || 1;
        const totalUnits = purchaseQty * factor;
        const unitCost = totalUnits > 0 ? Number(ps.supplies.current_price) / totalUnits : 0;
        return acc + unitCost * (Number(ps.quantity) || 0);
      }, 0);
    }

    // 2. Costo de subproductos componentes
    if (product.product_components && product.product_components.length > 0) {
      hasRecipe = true;
      currentMaterialsCost += product.product_components.reduce((acc: number, pc: any) => {
        if (!pc.component) return acc;
        const compCost = Number(pc.component.total_cost) || Number(pc.component.direct_cost) || 0;
        return acc + compCost * (Number(pc.quantity) || 0);
      }, 0);
    }

    const meta = parseProductMeta(product.description);
    const productYield = meta.yield || 1;
    const unitMaterialsCost = currentMaterialsCost / productYield;

    const costDifference = hasRecipe ? Math.abs(unitMaterialsCost - Number(product.direct_cost)) : 0;
    const isCostOutdated = Boolean(product.needs_price_review || (hasRecipe && costDifference > 0.5));

    if (isCostOutdated) {
      outdatedProducts.push({
        id: product.id,
        name: product.name,
        direct_cost: Number(product.direct_cost) || 0,
        currentMaterialsCost: Math.round(unitMaterialsCost * 100) / 100,
        difference: Math.round(costDifference * 100) / 100,
      });
    }
  }

  return outdatedProducts;
}

export interface ModifiedSupplyInfo {
  supplyId: string;
  name: string;
  category?: string;
  useUnit: string;
  purchaseUnit: string;
  prevPrice: number;
  newPrice: number;
  priceDiff: number;
  percentChange: number;
  prevUnitCost: number;
  newUnitCost: number;
  quantity: number;
  costImpact: number; // Impacto en el costo directo del producto considerando el rendimiento
  isIncrease: boolean;
}

/**
 * Detecta los insumos de la receta de un producto que hayan cambiado de precio
 * respecto a la última vez que el producto fue guardado/actualizado.
 */
export function detectModifiedSupplies(
  product: any,
  priceHistory: Array<{ id?: string; supply_id: string; price: number; changed_at: string }>
): ModifiedSupplyInfo[] {
  if (!product || !product.product_supplies || product.product_supplies.length === 0) {
    return [];
  }

  const meta = parseProductMeta(product.description);
  const productYield = meta.yield || 1;
  const productSavedAt = new Date(product.updated_at || product.created_at || 0).getTime();

  const modified: ModifiedSupplyInfo[] = [];

  for (const ps of product.product_supplies) {
    const supply = ps.supplies;
    if (!supply) continue;

    const currentPrice = Number(supply.current_price || 0);
    const purchaseQty = Number(supply.purchase_quantity || 1);
    const convFactor = Number(supply.conversion_factor || 1);
    const qty = Number(ps.quantity || 0);

    // Obtener historial ordenado de más reciente a más antiguo para este insumo
    const hist = (priceHistory || [])
      .filter((h) => h.supply_id === ps.supply_id)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

    let prevPrice: number | null = null;

    // 1. Buscar precio en historial que estaba vigente cuando se guardó el producto (changed_at <= productSavedAt)
    const atSave = hist.find((h) => new Date(h.changed_at).getTime() <= productSavedAt);
    if (atSave && Number(atSave.price) !== currentPrice) {
      prevPrice = Number(atSave.price);
    } else {
      // 2. Si no hay entrada anterior a productSavedAt o es idéntica al currentPrice, buscar la entrada más reciente distinta a currentPrice
      const diffEntry = hist.find((h) => Number(h.price) !== currentPrice);
      if (diffEntry) {
        prevPrice = Number(diffEntry.price);
      }
    }

    // 3. Fallback: Si no encontramos en historial pero supply.updated_at > productSavedAt
    if (prevPrice === null) {
      const supplyUpdatedAt = new Date(supply.updated_at || 0).getTime();
      if (supplyUpdatedAt > productSavedAt && (product.needs_price_review || Math.abs(currentPrice) > 0)) {
        if (hist.length > 1) {
          prevPrice = Number(hist[hist.length - 1].price);
        }
      }
    }

    if (prevPrice !== null && prevPrice !== currentPrice) {
      const prevUnitCost = calculateUnitCost(prevPrice, purchaseQty, convFactor);
      const newUnitCost = calculateUnitCost(currentPrice, purchaseQty, convFactor);
      const priceDiff = currentPrice - prevPrice;
      const percentChange = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
      const costImpact = ((newUnitCost - prevUnitCost) * qty) / productYield;

      modified.push({
        supplyId: ps.supply_id,
        name: supply.name || "Insumo",
        category: supply.category,
        useUnit: supply.use_unit || "u",
        purchaseUnit: supply.purchase_unit || "u",
        prevPrice,
        newPrice: currentPrice,
        priceDiff: Math.round(priceDiff * 100) / 100,
        percentChange: Math.round(percentChange * 10) / 10,
        prevUnitCost,
        newUnitCost,
        quantity: qty,
        costImpact: Math.round(costImpact * 100) / 100,
        isIncrease: currentPrice > prevPrice,
      });
    }
  }

  return modified;
}

/**
 * Valida si un nombre de producto ya existe en una lista de productos en memoria,
 * ignorando mayúsculas/minúsculas y espacios innecesarios (trim).
 * Permite excluir un ID (útil en edición para no autodetectar colisión).
 */
export function isDuplicateProductName(
  candidateName: string,
  existingProducts: Array<{ id: string; name: string }>,
  excludeProductId?: string
): boolean {
  const normalized = candidateName.trim().toLowerCase();
  if (!normalized) return false;
  return existingProducts.some(
    (p) => p.id !== excludeProductId && p.name.trim().toLowerCase() === normalized
  );
}

/**
 * Consulta en Supabase si ya existe un producto con el mismo nombre para el usuario actual.
 */
export async function checkProductNameExists(
  supabase: any,
  name: string,
  excludeProductId?: string
): Promise<boolean> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;

  try {
    let query = supabase
      .from("products")
      .select("id, name")
      .ilike("name", normalized);

    if (excludeProductId) {
      query = query.neq("id", excludeProductId);
    }

    const { data, error } = await query;
    if (error || !data) return false;

    return data.some(
      (p: any) => p.name.trim().toLowerCase() === normalized
    );
  } catch (err) {
    console.error("Error al consultar existencia de producto por nombre:", err);
    return false;
  }
}
