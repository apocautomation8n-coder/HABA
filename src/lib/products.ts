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
      cleanDescription: "",
    };
  }

  let text = rawDescription;
  let categoryLabel = "Otro";
  let categoryIcon = "✨";
  let isActive = true;

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

  // 3. Limpiar cualquier tag residual de foto si existiese
  text = text.replace(/\[Foto:\s*[^\]]+\]/gi, "");

  return {
    category: categoryLabel,
    categoryIcon,
    isActive,
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
}: {
  cleanDescription?: string;
  category?: string;
  isActive?: boolean;
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

  const clean = (cleanDescription || "").trim();
  if (metaTags.length > 0) {
    return clean ? `${metaTags.join(" ")}\n\n${clean}` : metaTags.join(" ");
  }

  return clean;
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
        )
      `);

    if (error || !products) return [];

    const outdatedProducts: OutdatedProductAlert[] = [];

    for (const product of products as any[]) {
      let currentMaterialsCost = 0;
      let hasRecipe = false;

      if (product.product_supplies && product.product_supplies.length > 0) {
        hasRecipe = true;
        currentMaterialsCost = product.product_supplies.reduce((acc: number, ps: any) => {
          if (!ps.supplies) return acc;
          const purchaseQty = Number(ps.supplies.purchase_quantity) || 1;
          const factor = Number(ps.supplies.conversion_factor) || 1;
          const totalUnits = purchaseQty * factor;
          const unitCost = totalUnits > 0 ? Number(ps.supplies.current_price) / totalUnits : 0;
          return acc + unitCost * (Number(ps.quantity) || 0);
        }, 0);
      }

      const costDifference = hasRecipe ? Math.abs(currentMaterialsCost - Number(product.direct_cost)) : 0;
      const isCostOutdated = Boolean(product.needs_price_review || (hasRecipe && costDifference > 0.5));

      if (isCostOutdated) {
        outdatedProducts.push({
          id: product.id,
          name: product.name,
          direct_cost: Number(product.direct_cost) || 0,
          currentMaterialsCost: Math.round(currentMaterialsCost * 100) / 100,
          difference: Math.round(costDifference * 100) / 100,
        });
      }
    }

    return outdatedProducts;
  } catch (err) {
    console.error("Error al obtener lista de productos desactualizados:", err);
    return [];
  }
}


