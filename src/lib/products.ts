/**
 * Módulo de utilidades y constantes de Productos para HABA
 */

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

  return {
    label: categoryStr || "Otro",
    icon: "✨",
    color: "#374151",
    bgColor: "#F3F4F6",
  };
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


