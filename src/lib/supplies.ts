import { normalizeUnit, parseNumber } from "@/lib/units";

export type UnitDimensionUnit = "cm" | "mm" | "m";

export interface SupplyItem {
  id?: string;
  name: string;
  category: "materia_prima" | "packaging" | "otro";
  purchase_unit: string;
  purchase_quantity: number;
  current_price: number;
  use_unit: string;
  conversion_factor: number;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_dimension_unit?: UnitDimensionUnit | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupplyLike {
  id?: string;
  name: string;
  category?: string;
  user_id?: string;
}

/**
 * Normaliza el nombre de un insumo eliminando espacios en los extremos y convirtiendo a minúsculas.
 */
export function normalizeSupplyName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase();
}

/**
 * Valida si un nombre de insumo ya existe en una lista de insumos en memoria,
 * ignorando mayúsculas/minúsculas y espacios innecesarios (trim).
 * Permite excluir un ID (útil en edición para no autodetectar colisión contra sí mismo).
 */
export function isDuplicateSupplyName(
  candidateName: string,
  existingSupplies: Array<{ id?: string; name: string }>,
  excludeSupplyId?: string
): boolean {
  const normalized = normalizeSupplyName(candidateName);
  if (!normalized) return false;

  return existingSupplies.some((s) => {
    if (!s || !s.name) return false;
    if (excludeSupplyId && s.id && s.id === excludeSupplyId) {
      return false;
    }
    return normalizeSupplyName(s.name) === normalized;
  });
}

/**
 * Consulta en Supabase si ya existe un insumo con el mismo nombre para el usuario actual.
 * Aplica ilike para búsqueda insensible a mayúsculas/minúsculas y filtra por user_id.
 */
export async function checkSupplyNameExists(
  supabase: any,
  name: string,
  excludeSupplyId?: string,
  userId?: string
): Promise<boolean> {
  const normalized = normalizeSupplyName(name);
  if (!normalized) return false;

  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    }

    if (!resolvedUserId) {
      console.warn("checkSupplyNameExists: No se pudo determinar el user_id.");
      return false;
    }

    let query = supabase
      .from("supplies")
      .select("id, name")
      .eq("user_id", resolvedUserId)
      .ilike("name", normalized);

    if (excludeSupplyId) {
      query = query.neq("id", excludeSupplyId);
    }

    const { data, error } = await query;
    if (error || !data) return false;

    return data.some(
      (s: any) => normalizeSupplyName(s.name) === normalized
    );
  } catch (err) {
    console.error("Error al consultar existencia de insumo por nombre:", err);
    return false;
  }
}

/**
 * Determina si un insumo se compra o utiliza por unidad ('u' o 'unidad').
 */
export function isUnitSupply(supply?: { purchase_unit?: string | null; use_unit?: string | null } | null): boolean {
  if (!supply) return false;
  const normPurchase = normalizeUnit(supply.purchase_unit);
  const normUse = normalizeUnit(supply.use_unit);
  return (
    normPurchase === "u" ||
    normPurchase === "unidad" ||
    normPurchase === "unidades" ||
    normUse === "u" ||
    normUse === "unidad" ||
    normUse === "unidades"
  );
}

/**
 * Determina si un insumo por unidad cuenta con medidas dimensionales base válidas (unit_width y unit_length > 0).
 */
export function isUnitSupplyWithDimensions(supply?: {
  purchase_unit?: string | null;
  use_unit?: string | null;
  unit_width?: number | null;
  unit_length?: number | null;
  unit_dimension_unit?: string | null;
} | null): boolean {
  if (!supply) return false;
  if (!isUnitSupply(supply)) return false;
  const w = Number(supply.unit_width);
  const l = Number(supply.unit_length);
  return !isNaN(w) && w > 0 && !isNaN(l) && l > 0;
}

/**
 * Convierte un valor dimensional a centímetros según la unidad dada.
 */
function toCm(val: number, unit: string = "cm"): number {
  if (unit === "m") return val * 100;
  if (unit === "mm") return val / 10;
  return val;
}

/**
 * Calcula la fracción de unidad consumida por corte de piezas:
 * fracción = (ancho_corte × largo_corte × piezas) / (ancho_base × largo_base)
 */
export function calculateUnitFractionQuantity({
  pieces,
  width,
  widthUnit = "cm",
  length,
  lengthUnit = "cm",
  unitWidth,
  unitLength,
  unitDimensionUnit = "cm",
}: {
  pieces: number | string;
  width: number | string;
  widthUnit?: "m" | "cm" | "mm";
  length: number | string;
  lengthUnit?: "m" | "cm" | "mm";
  unitWidth: number | string;
  unitLength: number | string;
  unitDimensionUnit?: "m" | "cm" | "mm" | string | null;
}): number {
  const p = typeof pieces === "number" ? pieces : parseFloat(String(pieces)) || 1;
  const w = typeof width === "number" ? width : parseFloat(String(width)) || 0;
  const l = typeof length === "number" ? length : parseFloat(String(length)) || 0;
  const uW = typeof unitWidth === "number" ? unitWidth : parseFloat(String(unitWidth)) || 0;
  const uL = typeof unitLength === "number" ? unitLength : parseFloat(String(unitLength)) || 0;

  if (w <= 0 || l <= 0 || uW <= 0 || uL <= 0) return 0;
  const safePieces = p > 0 ? p : 1;

  const cutWidthCm = toCm(w, widthUnit);
  const cutLengthCm = toCm(l, lengthUnit);
  const cutAreaCm2 = safePieces * cutWidthCm * cutLengthCm;

  const baseDimUnit = unitDimensionUnit || "cm";
  const baseWidthCm = toCm(uW, baseDimUnit);
  const baseLengthCm = toCm(uL, baseDimUnit);
  const baseAreaCm2 = baseWidthCm * baseLengthCm;

  if (baseAreaCm2 <= 0) return 0;

  const fraction = cutAreaCm2 / baseAreaCm2;
  return parseFloat(fraction.toFixed(6));
}

/**
 * Convierte una cantidad decimal en una representación fraccionaria legible y amigable
 * para insumos por unidad en recipes (ej. "aprox. 1/75 de unidad", "1/2 de unidad").
 */
export function getFriendlyFractionLabel(
  qty: number | string,
  unitLabel: string = "unidad",
  locale: string = "es-AR"
): string | null {
  const num = typeof qty === "number" ? qty : parseNumber(qty, locale);
  if (isNaN(num) || num <= 0) return null;

  const rawUnit = unitLabel.trim().toLowerCase();
  const cleanUnit = rawUnit === "u" ? "unidad" : rawUnit;

  // Si es un entero positivo exacto (ej. 1, 2, 5), no requiere etiqueta fraccionaria
  if (Number.isInteger(num)) {
    return null;
  }

  // Lista de fracciones comunes conocidas para números menores a 1
  const commonFractions = [
    { dec: 1 / 2, label: "1/2" },
    { dec: 1 / 3, label: "1/3" },
    { dec: 2 / 3, label: "2/3" },
    { dec: 1 / 4, label: "1/4" },
    { dec: 3 / 4, label: "3/4" },
    { dec: 1 / 5, label: "1/5" },
    { dec: 2 / 5, label: "2/5" },
    { dec: 3 / 5, label: "3/5" },
    { dec: 4 / 5, label: "4/5" },
    { dec: 1 / 6, label: "1/6" },
    { dec: 5 / 6, label: "5/6" },
    { dec: 1 / 8, label: "1/8" },
    { dec: 3 / 8, label: "3/8" },
    { dec: 5 / 8, label: "5/8" },
    { dec: 7 / 8, label: "7/8" },
    { dec: 1 / 10, label: "1/10" },
    { dec: 1 / 12, label: "1/12" },
    { dec: 1 / 16, label: "1/16" },
  ];

  if (num < 1) {
    // 1. Probar fracciones comunes con tolerancia estricta
    for (const f of commonFractions) {
      if (Math.abs(num - f.dec) / f.dec < 0.02) {
        const isExact = Math.abs(num - f.dec) < 0.0001;
        return isExact ? `${f.label} de ${cleanUnit}` : `aprox. ${f.label} de ${cleanUnit}`;
      }
    }

    // 2. Probar denominador 1/N
    const inv = 1 / num;
    const n = Math.round(inv);
    if (n >= 2 && n <= 10000) {
      const approxVal = 1 / n;
      const relativeError = Math.abs(num - approxVal) / num;
      if (relativeError < 0.06) {
        const isExact = Math.abs(num - approxVal) < 0.0001;
        return isExact ? `1/${n} de ${cleanUnit}` : `aprox. 1/${n} de ${cleanUnit}`;
      }
    }

    // 3. Fallback con locale formateado con hasta 4 decimales
    const formatted = num.toLocaleString(locale, { maximumFractionDigits: 4 });
    return `${formatted} de ${cleanUnit}`;
  }

  // Si es mayor a 1 con decimales
  const integerPart = Math.floor(num);
  const decimalPart = num - integerPart;
  for (const f of commonFractions) {
    if (Math.abs(decimalPart - f.dec) / f.dec < 0.02) {
      const isExact = Math.abs(decimalPart - f.dec) < 0.0001;
      return isExact
        ? `${integerPart} y ${f.label} ${cleanUnit}es`
        : `aprox. ${integerPart} y ${f.label} ${cleanUnit}es`;
    }
  }

  const formatted = num.toLocaleString(locale, { maximumFractionDigits: 4 });
  return `${formatted} ${cleanUnit}es`;
}

