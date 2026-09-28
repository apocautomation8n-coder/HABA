/**
 * Módulo de utilidades y constantes de Productos para HABA
 */

import { calculateUnitCost, formatCurrency } from "./units";
import { createClient } from "./supabase/client";

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

export interface CustomCategoryItem {
  id: string;
  label: string;
  icon: string;
  color?: string;
  bgColor?: string;
  isCustom?: boolean;
}

export const CUSTOM_CATEGORIES_STORAGE_KEY = "haba_custom_product_categories";
export const DELETED_CATEGORIES_STORAGE_KEY = "haba_deleted_product_categories";

/**
 * Normaliza una cadena de categoría quitando acentos, mayúsculas y espacios sobrantes.
 */
export function normalizeCategoryString(str?: string | null): string {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Genera un identificador determinista y estable para cualquier categoría (preset o personalizada).
 */
export function getCategoryId(label: string): string {
  const norm = normalizeCategoryString(label);
  const preset = PRODUCT_CATEGORIES.find(
    (c) => normalizeCategoryString(c.id) === norm || normalizeCategoryString(c.label) === norm
  );
  if (preset) return preset.id;
  const slug = norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `custom-${slug || "cat"}`;
}

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
 * Obtiene la lista de nombres o IDs de categorías eliminadas por el usuario
 */
export function getDeletedCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Guarda la lista de categorías eliminadas en localStorage
 */
export function saveDeletedCategories(items: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DELETED_CATEGORIES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

/**
 * Marca una categoría como eliminada (por nombre o id)
 */
export function markCategoryAsDeleted(labelOrId: string): void {
  const norm = normalizeCategoryString(labelOrId);
  if (!norm || norm === "otro") return;
  const current = getDeletedCategories();
  const normList = current.map(normalizeCategoryString);
  if (!normList.includes(norm)) {
    saveDeletedCategories([...current, labelOrId.trim()]);
  }
}

/**
 * Desmarca una categoría como eliminada si el usuario la vuelve a crear o renombrar
 */
export function unmarkCategoryAsDeleted(labelOrId: string): void {
  const norm = normalizeCategoryString(labelOrId);
  if (!norm) return;
  const current = getDeletedCategories();
  saveDeletedCategories(current.filter((c) => normalizeCategoryString(c) !== norm));
}

/**
 * Verifica si una categoría ha sido eliminada por el usuario
 */
export function isCategoryDeleted(labelOrId?: string | null): boolean {
  if (!labelOrId || typeof window === "undefined") return false;
  const norm = normalizeCategoryString(labelOrId);
  if (!norm || norm === "otro") return false;
  const deleted = getDeletedCategories();
  const deletedSet = new Set(deleted.map(normalizeCategoryString));
  if (deletedSet.has(norm)) return true;
  const id = getCategoryId(labelOrId);
  return deletedSet.has(normalizeCategoryString(id));
}

export interface ParsedProductMeta {
  category: string;
  categoryIcon: string;
  isActive: boolean;
  yield: number;
  cleanDescription: string;
  lastReviewedAt?: string | null;
  priceSnapshots?: Record<string, number>;
}

/**
 * Parsea los metadatos estructurados dentro del campo description del producto
 */
export function parseProductMeta(rawDescription?: string | null, productId?: string): ParsedProductMeta {
  if (!rawDescription) {
    let lastReviewedAt: string | null = null;
    let priceSnapshots: Record<string, number> = {};
    if (typeof window !== "undefined" && productId) {
      try {
        const stored = localStorage.getItem(`haba_product_review_${productId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          lastReviewedAt = parsed.lastReviewedAt || null;
          priceSnapshots = parsed.priceSnapshots || {};
        }
      } catch {}
    }
    return {
      category: "Otro",
      categoryIcon: "✨",
      isActive: true,
      yield: 1,
      cleanDescription: "",
      lastReviewedAt,
      priceSnapshots,
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
    if (isCategoryDeleted(rawCat)) {
      categoryLabel = "Otro";
      categoryIcon = "✨";
    } else {
      const matchedPreset = PRODUCT_CATEGORIES.find(
        (c) => c.id.toLowerCase() === rawCat.toLowerCase() || c.label.toLowerCase() === rawCat.toLowerCase()
      );

      if (matchedPreset) {
        categoryLabel = matchedPreset.label;
        categoryIcon = matchedPreset.icon;
      } else {
        const stored = getStoredCustomCategories();
        const matchedStored = stored.find(
          (c) =>
            normalizeCategoryString(c.label) === normalizeCategoryString(rawCat) ||
            normalizeCategoryString(c.id) === normalizeCategoryString(rawCat)
        );
        if (matchedStored) {
          categoryLabel = matchedStored.label;
          categoryIcon = matchedStored.icon || "🏷️";
        } else {
          categoryLabel = rawCat;
          categoryIcon = "✨";
        }
      }
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

  // 4. Extraer [Revisión: ...]
  let lastReviewedAt: string | null = null;
  const revMatch = text.match(/\[Revisi[oó]n:\s*([^\]]+)\]/i);
  if (revMatch) {
    lastReviewedAt = revMatch[1].trim();
    text = text.replace(revMatch[0], "");
  }

  // 5. Extraer [PreciosRef: ...]
  let priceSnapshots: Record<string, number> = {};
  const snapMatch = text.match(/\[PreciosRef:\s*([^\]]+)\]/i);
  if (snapMatch) {
    const rawSnapshots = snapMatch[1].trim();
    const pairs = rawSnapshots.split(";");
    for (const pair of pairs) {
      const [sId, pStr] = pair.split("=");
      if (sId && pStr) {
        const val = parseFloat(pStr.trim());
        if (!isNaN(val)) {
          priceSnapshots[sId.trim()] = val;
        }
      }
    }
    text = text.replace(snapMatch[0], "");
  }

  // 6. Si no estaban en texto pero están en localStorage, leer de ahí como respaldo
  if (typeof window !== "undefined" && productId) {
    try {
      const stored = localStorage.getItem(`haba_product_review_${productId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!lastReviewedAt && parsed.lastReviewedAt) {
          lastReviewedAt = parsed.lastReviewedAt;
        }
        if (Object.keys(priceSnapshots).length === 0 && parsed.priceSnapshots) {
          priceSnapshots = parsed.priceSnapshots;
        }
      }
    } catch {}
  }

  // 7. Limpiar cualquier tag residual de foto si existiese
  text = text.replace(/\[Foto:\s*[^\]]+\]/gi, "");

  return {
    category: categoryLabel,
    categoryIcon,
    isActive,
    yield: yieldVal,
    cleanDescription: text.trim(),
    lastReviewedAt,
    priceSnapshots,
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
  lastReviewedAt,
  priceSnapshots,
}: {
  cleanDescription?: string;
  category?: string;
  isActive?: boolean;
  yieldValue?: number;
  lastReviewedAt?: string | null;
  priceSnapshots?: Record<string, number>;
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

  if (lastReviewedAt) {
    metaTags.push(`[Revisión: ${lastReviewedAt.trim()}]`);
  }

  if (priceSnapshots && Object.keys(priceSnapshots).length > 0) {
    const serialized = Object.entries(priceSnapshots)
      .filter(([id, price]) => Boolean(id) && typeof price === "number" && !isNaN(price))
      .map(([id, price]) => `${id}=${price}`)
      .join(";");
    if (serialized) {
      metaTags.push(`[PreciosRef: ${serialized}]`);
    }
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

/**
 * Determina de forma robusta e insensible a acentos/mayúsculas/espacios
 * si un producto pertenece a una categoría seleccionada en los filtros.
 */
export function isCategoryMatch(
  productCategory: string | undefined | null,
  selectedCategoryFilter: string | undefined | null,
  allCategories?: CustomCategoryItem[]
): boolean {
  if (!selectedCategoryFilter || selectedCategoryFilter === "all") return true;

  const normProduct = normalizeCategoryString(productCategory);
  const normFilter = normalizeCategoryString(selectedCategoryFilter);

  if (!normProduct) return normFilter === "otro";
  if (normProduct === normFilter) return true;

  // Comparar por ID determinista del producto
  const productId = getCategoryId(productCategory || "");
  if (productId === selectedCategoryFilter || normalizeCategoryString(productId) === normFilter) {
    return true;
  }

  // Buscar objeto de la categoría seleccionada en el catálogo
  const cats = allCategories || getAllProductCategories();
  const selectedCat = cats.find(
    (c) =>
      c.id === selectedCategoryFilter ||
      normalizeCategoryString(c.id) === normFilter ||
      normalizeCategoryString(c.label) === normFilter
  );

  if (selectedCat) {
    const normCatLabel = normalizeCategoryString(selectedCat.label);
    const normCatId = normalizeCategoryString(selectedCat.id);

    if (normProduct === normCatLabel || normProduct === normCatId) return true;
    if (productId === selectedCat.id || normalizeCategoryString(productId) === normCatId) return true;

    // Coincidencia para categorías compuestas ("Papelería & Libretas" vs "Papelería")
    const pFirst = normProduct.split("&")[0].split("/")[0].trim();
    const fFirst = normCatLabel.split("&")[0].split("/")[0].trim();
    if (pFirst && fFirst && (pFirst === fFirst || normCatLabel.includes(pFirst) || normProduct.includes(fFirst))) {
      return true;
    }
  }

  return false;
}

/**
 * Obtiene la lista completa y unificada de categorías (presets + personalizadas + categorías de productos existentes)
 * filtrando aquellas que hayan sido eliminadas por el usuario, y garantizando IDs deterministas.
 */
export function getAllProductCategories(existingProducts?: { description?: string | null }[]): CustomCategoryItem[] {
  const deleted = getDeletedCategories();
  const deletedSet = new Set(deleted.map(normalizeCategoryString));

  // Presets predeterminados (excepto los eliminados o editados)
  const baseCategories: CustomCategoryItem[] = PRODUCT_CATEGORIES
    .filter((cat) => {
      if (cat.id === "otro") return true;
      const normLabel = normalizeCategoryString(cat.label);
      const normId = normalizeCategoryString(cat.id);
      return !deletedSet.has(normLabel) && !deletedSet.has(normId);
    })
    .map((cat) => ({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      bgColor: cat.bgColor,
      isCustom: false,
    }));

  const storedCustom = getStoredCustomCategories().filter((cat) => {
    const normLabel = normalizeCategoryString(cat.label);
    const normId = normalizeCategoryString(cat.id);
    return !deletedSet.has(normLabel) && !deletedSet.has(normId);
  });

  const categoryMap = new Map<string, CustomCategoryItem>();

  for (const cat of baseCategories) {
    categoryMap.set(normalizeCategoryString(cat.label), cat);
  }

  for (const cat of storedCustom) {
    const normKey = normalizeCategoryString(cat.label);
    categoryMap.set(normKey, {
      ...cat,
      id: cat.id || getCategoryId(cat.label),
      isCustom: true,
    });
  }

  // Extraer también cualquier categoría presente en los productos existentes de forma estable
  if (existingProducts && Array.isArray(existingProducts)) {
    for (const p of existingProducts) {
      const meta = parseProductMeta(p.description);
      const catTrimmed = (meta.category || "").trim();
      const normKey = normalizeCategoryString(catTrimmed);
      const stableId = getCategoryId(catTrimmed);
      if (
        catTrimmed &&
        !deletedSet.has(normKey) &&
        !deletedSet.has(normalizeCategoryString(stableId)) &&
        !categoryMap.has(normKey)
      ) {
        const newCat: CustomCategoryItem = {
          id: stableId,
          label: catTrimmed,
          icon: meta.categoryIcon || "🏷️",
          color: "#1F7A4C",
          bgColor: "#DCF4D7",
          isCustom: true,
        };
        categoryMap.set(normKey, newCat);
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
  unmarkCategoryAsDeleted(trimmedLabel);
  unmarkCategoryAsDeleted(getCategoryId(trimmedLabel));

  const existing = getStoredCustomCategories();
  const id = getCategoryId(trimmedLabel);
  const newCat: CustomCategoryItem = {
    id,
    label: trimmedLabel,
    icon: icon || "🏷️",
    color: "#1F7A4C",
    bgColor: "#DCF4D7",
    isCustom: true,
  };

  // Evitar duplicados por nombre normalizado
  const normNew = normalizeCategoryString(trimmedLabel);
  const filtered = existing.filter((c) => normalizeCategoryString(c.label) !== normNew);
  const updated = [...filtered, newCat];
  saveStoredCustomCategories(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("haba_categories_changed"));
  }

  return newCat;
}

/**
 * Renombra una categoría (preset o personalizada) y actualiza en Supabase todos los productos que la utilicen.
 * Utiliza la API /api/categories/[id] y como fallback directo el cliente Supabase.
 */
export async function updateProductCategory(
  oldLabel: string,
  newLabel: string,
  newIcon?: string,
  supabaseClient?: any,
  oldId?: string
): Promise<{ updatedCount: number; success: boolean }> {
  const trimmedOld = oldLabel.trim();
  const trimmedNew = newLabel.trim();
  if (!trimmedNew || trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) {
    return { updatedCount: 0, success: true };
  }

  const normOld = normalizeCategoryString(trimmedOld);
  const normOldId = oldId ? normalizeCategoryString(oldId) : getCategoryId(trimmedOld);

  // 1. Marcar el nombre/ID anterior como eliminado para que no resurja como preset o producto residual
  markCategoryAsDeleted(trimmedOld);
  if (oldId) markCategoryAsDeleted(oldId);
  markCategoryAsDeleted(getCategoryId(trimmedOld));

  // 2. Asegurarse de que el nuevo nombre no esté en la lista de eliminadas
  unmarkCategoryAsDeleted(trimmedNew);
  unmarkCategoryAsDeleted(getCategoryId(trimmedNew));

  // 3. Actualizar o agregar en storedCustom
  const stored = getStoredCustomCategories();
  let foundInStored = false;
  const updatedStored = stored.map((cat) => {
    if (
      normalizeCategoryString(cat.label) === normOld ||
      (oldId && normalizeCategoryString(cat.id) === normOldId)
    ) {
      foundInStored = true;
      return {
        ...cat,
        id: getCategoryId(trimmedNew),
        label: trimmedNew,
        icon: newIcon || cat.icon || "🏷️",
      };
    }
    return cat;
  });

  if (!foundInStored) {
    // Si era un preset o venía de producto, agregamos la nueva categoría a stored
    updatedStored.push({
      id: getCategoryId(trimmedNew),
      label: trimmedNew,
      icon: newIcon || "🏷️",
      color: "#1F7A4C",
      bgColor: "#DCF4D7",
      isCustom: true,
    });
  }

  saveStoredCustomCategories(updatedStored);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("haba_categories_changed"));
  }

  let updatedCount = 0;

  // 4. Actualización vía API Route si estamos en el cliente
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(oldId || trimmedOld)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldName: trimmedOld,
          newName: trimmedNew,
          icon: newIcon,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        updatedCount = json.updatedProductsCount || 0;
        return { updatedCount, success: true };
      }
    } catch (apiErr) {
      console.warn("Fallo llamando a /api/categories/[id], utilizando cliente directo:", apiErr);
    }
  }

  // 5. Fallback directo a Supabase (usando cliente inyectado o cliente del navegador)
  const client = supabaseClient || (typeof window !== "undefined" ? createClient() : null);
  if (client) {
    try {
      const { data: products } = await client
        .from("products")
        .select("id, description");

      if (products && products.length > 0) {
        for (const prod of products) {
          const meta = parseProductMeta(prod.description);
          const metaNorm = normalizeCategoryString(meta.category);
          const metaId = getCategoryId(meta.category);
          if (
            metaNorm === normOld ||
            (oldId && normalizeCategoryString(oldId) === metaNorm) ||
            (oldId && metaId === oldId)
          ) {
            const updatedDescription = serializeProductDescription({
              cleanDescription: meta.cleanDescription,
              category: trimmedNew,
              isActive: meta.isActive,
              yieldValue: meta.yield,
            });

            await client
              .from("products")
              .update({ description: updatedDescription })
              .eq("id", prod.id);

            updatedCount++;
          }
        }
      }
    } catch (err) {
      console.error("Error al actualizar productos tras renombrar categoría:", err);
      return { updatedCount, success: false };
    }
  }

  return { updatedCount, success: true };
}

/**
 * Elimina una categoría (preset o personalizada) y reasigna los productos que la utilicen a 'Otro' en Supabase.
 * Utiliza la API /api/categories/[id] y como fallback directo el cliente Supabase.
 */
export async function deleteProductCategory(
  label: string,
  supabaseClient?: any,
  reassignTo: string = "Otro",
  catId?: string
): Promise<{ affectedCount: number; success: boolean }> {
  const trimmed = label.trim();
  const normLabel = normalizeCategoryString(trimmed);
  const normCatId = catId ? normalizeCategoryString(catId) : getCategoryId(trimmed);

  // 1. Marcar como eliminada
  markCategoryAsDeleted(trimmed);
  if (catId) markCategoryAsDeleted(catId);
  markCategoryAsDeleted(getCategoryId(trimmed));

  // 2. Eliminar de localStorage
  const stored = getStoredCustomCategories();
  const updatedStored = stored.filter(
    (c) =>
      normalizeCategoryString(c.label) !== normLabel &&
      (!catId || normalizeCategoryString(c.id) !== normCatId)
  );
  saveStoredCustomCategories(updatedStored);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("haba_categories_changed"));
  }

  let affectedCount = 0;

  // 3. Intentar eliminación vía API Route si estamos en el cliente
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(catId || trimmed)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          reassignTo,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        affectedCount = json.affectedProductsCount || 0;
        return { affectedCount, success: true };
      }
    } catch (apiErr) {
      console.warn("Fallo llamando a DELETE /api/categories/[id], utilizando cliente directo:", apiErr);
    }
  }

  // 4. Fallback directo a Supabase
  const client = supabaseClient || (typeof window !== "undefined" ? createClient() : null);
  if (client) {
    try {
      const { data: products } = await client
        .from("products")
        .select("id, description");

      if (products && products.length > 0) {
        for (const prod of products) {
          const meta = parseProductMeta(prod.description);
          const metaNorm = normalizeCategoryString(meta.category);
          const metaId = getCategoryId(meta.category);
          if (
            metaNorm === normLabel ||
            (catId && normalizeCategoryString(catId) === metaNorm) ||
            (catId && metaId === catId)
          ) {
            const updatedDescription = serializeProductDescription({
              cleanDescription: meta.cleanDescription,
              category: reassignTo,
              isActive: meta.isActive,
              yieldValue: meta.yield,
            });

            await client
              .from("products")
              .update({ description: updatedDescription })
              .eq("id", prod.id);

            affectedCount++;
          }
        }
      }
    } catch (err) {
      console.error("Error al reasignar productos tras eliminar categoría:", err);
      return { affectedCount, success: false };
    }
  }

  return { affectedCount, success: true };
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
        description,
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
            conversion_factor,
            updated_at
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
          description,
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
              conversion_factor,
              updated_at
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
    const productYield = meta.yield > 0 ? meta.yield : 1;
    const unitMaterialsCost = currentMaterialsCost / productYield;
    const roundedUnitCost = Math.round(unitMaterialsCost * 100) / 100;
    const savedDirectCost = Math.round(Number(product.direct_cost || 0) * 100) / 100;

    const costDifference = hasRecipe ? Math.abs(roundedUnitCost - savedDirectCost) : 0;
    const isCostOutdated = Boolean(product.needs_price_review || (hasRecipe && costDifference > 0.05));

    if (isCostOutdated) {
      outdatedProducts.push({
        id: product.id,
        name: product.name,
        direct_cost: savedDirectCost,
        currentMaterialsCost: roundedUnitCost,
        difference: Math.round(costDifference * 100) / 100,
      });
    }
  }

  return outdatedProducts;
}

export interface PriceDifferenceResult {
  diff: number; // currentPrice - savedPrice
  percent: number; // (diff / savedPrice) * 100
  absDiff: number; // Math.abs(diff)
  absPercent: number; // Math.abs(percent)
  isIncrease: boolean; // diff > 0.001
  isDecrease: boolean; // diff < -0.001
  hasChange: boolean;
  badgeLabel: string; // "Aumentó" | "Bajó"
  arrow: string; // "↗" | "↘"
  sign: "+" | "-";
  formattedPercent: string; // "+X.X%" | "-X.X%"
  formattedBadge: string; // "↗ Aumentó (+X.X%)" | "↘ Bajó (-X.X%)"
  formattedImpact: string; // "+$ X,XX" | "-$ X,XX"
}

/**
 * Calcula la variación matemática real y el formateo de etiquetas para diferencias de precio.
 * Regla estricta:
 * - diff = currentPrice - savedPrice
 * - percent = savedPrice > 0 ? (diff / savedPrice) * 100 : 0
 * - diff > 0.001: aumento ("↗ Aumentó (+X.X%)" e impacto "+$ X.XX")
 * - diff < -0.001: baja ("↘ Bajó (-X.X%)" e impacto "-$ X.XX")
 * - Math.abs(diff) <= 0.001: null (sin variación)
 */
export function getPriceDifference(
  currentPrice: number,
  savedPrice: number,
  costImpact?: number
): PriceDifferenceResult | null {
  const diff = currentPrice - savedPrice;
  if (Math.abs(diff) <= 0.001) {
    return null;
  }

  const percent = savedPrice > 0 ? (diff / savedPrice) * 100 : 0;
  const isIncrease = diff > 0.001;
  const isDecrease = diff < -0.001;
  const absDiff = Math.abs(diff);
  const absPercent = Math.round(Math.abs(percent) * 10) / 10;
  const sign = isIncrease ? "+" : "-";

  const badgeLabel = isIncrease ? "Aumentó" : "Bajó";
  const arrow = isIncrease ? "↗" : "↘";
  const formattedPercent = `${sign}${absPercent}%`;
  const formattedBadge = `${arrow} ${badgeLabel} (${sign}${absPercent}%)`;

  const absImpact = costImpact !== undefined ? Math.abs(costImpact) : 0;
  const formattedImpact = `${sign}${formatCurrency(absImpact)}`;

  return {
    diff,
    percent,
    absDiff,
    absPercent,
    isIncrease,
    isDecrease,
    hasChange: isIncrease || isDecrease,
    badgeLabel,
    arrow,
    sign,
    formattedPercent,
    formattedBadge,
    formattedImpact,
  };
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
  costImpact: number; // Impacto absoluto positivo en el costo directo del producto
  isIncrease: boolean;
  isDecrease: boolean;
  formattedPercent: string;
  formattedBadge: string;
  formattedImpact: string;
}

/**
 * Detecta los insumos de la receta de un producto que hayan cambiado de precio
 * respecto a la última vez que el producto fue guardado/revisado.
 */
export function detectModifiedSupplies(
  product: any,
  priceHistory: Array<{ id?: string; supply_id: string; price: number; changed_at: string }>
): ModifiedSupplyInfo[] {
  if (!product || !product.product_supplies || product.product_supplies.length === 0) {
    return [];
  }

  const meta = parseProductMeta(product.description, product.id);
  const productYield = meta.yield > 0 ? meta.yield : 1;

  // Fecha de referencia: última revisión explícita en meta, o en localStorage, o updated_at, o created_at
  let reviewTime = meta.lastReviewedAt ? new Date(meta.lastReviewedAt).getTime() : 0;
  let priceSnapshots: Record<string, number> = meta.priceSnapshots || {};

  if (typeof window !== "undefined" && product.id) {
    try {
      const stored = localStorage.getItem(`haba_product_review_${product.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.lastReviewedAt) {
          const storedTime = new Date(parsed.lastReviewedAt).getTime();
          if (storedTime > reviewTime) {
            reviewTime = storedTime;
          }
        }
        if (parsed.priceSnapshots && Object.keys(priceSnapshots).length === 0) {
          priceSnapshots = parsed.priceSnapshots;
        }
      }
    } catch {}
  }

  const productSavedAt = Math.max(
    reviewTime,
    new Date(product.updated_at || product.created_at || 0).getTime()
  );

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

    // 1. ¿Tenemos un precio de referencia guardado explícitamente en el snapshot?
    let savedPrice: number | null = null;
    if (priceSnapshots && priceSnapshots[ps.supply_id] !== undefined) {
      savedPrice = Number(priceSnapshots[ps.supply_id]);
    }

    // 2. Si no hay snapshot explícito, determinamos el precio de referencia histórico
    if (savedPrice === null) {
      const changesAfterSave = hist.filter(
        (h) => new Date(h.changed_at).getTime() > productSavedAt + 1000
      );

      const supplyUpdatedAt = supply.updated_at ? new Date(supply.updated_at).getTime() : 0;
      const supplyUpdatedAfterSave = supplyUpdatedAt > productSavedAt + 1000;

      if (changesAfterSave.length > 0) {
        const atSave = hist.find((h) => new Date(h.changed_at).getTime() <= productSavedAt + 1000);
        if (atSave) {
          savedPrice = Number(atSave.price);
        } else {
          savedPrice = Number(changesAfterSave[changesAfterSave.length - 1].price);
        }
      } else if (supplyUpdatedAfterSave) {
        const atSave = hist.find((h) => new Date(h.changed_at).getTime() <= productSavedAt + 1000);
        if (atSave && Math.abs(Number(atSave.price) - currentPrice) > 0.001) {
          savedPrice = Number(atSave.price);
        } else if (hist.length > 0) {
          const diffEntry = hist.find((h) => Math.abs(Number(h.price) - currentPrice) > 0.001);
          if (diffEntry) {
            savedPrice = Number(diffEntry.price);
          }
        }
      } else if (product.needs_price_review) {
        const atSave = hist.find((h) => new Date(h.changed_at).getTime() <= productSavedAt + 1000);
        if (atSave && Math.abs(Number(atSave.price) - currentPrice) > 0.001) {
          savedPrice = Number(atSave.price);
        } else if (hist.length > 0) {
          const diffEntry = hist.find((h) => Math.abs(Number(h.price) - currentPrice) > 0.001);
          if (diffEntry) {
            savedPrice = Number(diffEntry.price);
          }
        }
      }
    }

    // Si no hubo cambios posteriores ni snapshot distinto, savedPrice === currentPrice
    if (savedPrice === null) {
      savedPrice = currentPrice;
    }

    const diff = currentPrice - savedPrice;
    if (Math.abs(diff) <= 0.001) {
      continue;
    }

    const prevUnitCost = calculateUnitCost(savedPrice, purchaseQty, convFactor);
    const newUnitCost = calculateUnitCost(currentPrice, purchaseQty, convFactor);
    const costImpact = ((newUnitCost - prevUnitCost) * qty) / productYield;

    const variation = getPriceDifference(currentPrice, savedPrice, costImpact);
    if (!variation) continue;

    modified.push({
      supplyId: ps.supply_id,
      name: supply.name || "Insumo",
      category: supply.category,
      useUnit: supply.use_unit || "u",
      purchaseUnit: supply.purchase_unit || "u",
      prevPrice: savedPrice,
      newPrice: currentPrice,
      priceDiff: variation.diff,
      percentChange: variation.absPercent,
      prevUnitCost,
      newUnitCost,
      quantity: qty,
      costImpact: Math.round(Math.abs(costImpact) * 100) / 100,
      isIncrease: variation.isIncrease,
      isDecrease: variation.isDecrease,
      formattedPercent: variation.formattedPercent,
      formattedBadge: variation.formattedBadge,
      formattedImpact: variation.formattedImpact,
    });
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
