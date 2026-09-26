export interface UnitPreset {
  id: string;
  name: string;
  shortLabel: string;
  category: "peso" | "longitud" | "superficie" | "volumen" | "unidad";
  purchaseUnit: string;
  useUnit: string;
  defaultFactor: number; // Cuántas useUnit hay en 1 purchaseUnit
  example: string;
  isStandard: boolean; // true para peso, volumen, longitud, superficie y fijas (docena, unidad) -> NO pide rendimiento adicional
  promptQuestion?: string; // Pregunta condicional cuando isStandard === false
  promptPlaceholder?: string;
  keywords: string[];
}

export const UNIT_PRESETS: UnitPreset[] = [
  // ⚖️ PESO (Estándar - No solicita rendimiento adicional)
  {
    id: "kg-g",
    name: "Kilos a Gramos (kg → g)",
    shortLabel: "Kilos (kg)",
    category: "peso",
    purchaseUnit: "kg",
    useUnit: "g",
    defaultFactor: 1000,
    isStandard: true,
    example: "1 kg = 1.000 g de cera, harina o resina",
    keywords: ["kg", "kilo", "kilos", "kilogramo", "kilogramos", "peso", "g", "gramos", "harina", "cera"],
  },
  {
    id: "g-g",
    name: "Gramos directos (g → g)",
    shortLabel: "Gramos (g)",
    category: "peso",
    purchaseUnit: "g",
    useUnit: "g",
    defaultFactor: 1,
    isStandard: true,
    example: "1 g = 1 g directo",
    keywords: ["g", "gramo", "gramos", "peso"],
  },
  {
    id: "g-mg",
    name: "Gramos a Miligramos (g → mg)",
    shortLabel: "Gramos (g) → mg",
    category: "peso",
    purchaseUnit: "g",
    useUnit: "mg",
    defaultFactor: 1000,
    isStandard: true,
    example: "1 g = 1.000 mg de pigmento o activo",
    keywords: ["mg", "miligramo", "miligramos", "g", "pigmento"],
  },

  // 🧪 VOLUMEN (Estándar - No solicita rendimiento adicional)
  {
    id: "l-ml",
    name: "Litros a Mililitros (l → ml)",
    shortLabel: "Litros (l)",
    category: "volumen",
    purchaseUnit: "l",
    useUnit: "ml",
    defaultFactor: 1000,
    isStandard: true,
    example: "1 litro = 1.000 ml de alcohol, aceite o esencia",
    keywords: ["l", "litro", "litros", "ml", "mililitros", "volumen", "liquido", "aceite", "alcohol"],
  },
  {
    id: "ml-ml",
    name: "Mililitros directos (ml → ml)",
    shortLabel: "Mililitros (ml)",
    category: "volumen",
    purchaseUnit: "ml",
    useUnit: "ml",
    defaultFactor: 1,
    isStandard: true,
    example: "1 ml = 1 ml directo",
    keywords: ["ml", "mililitro", "mililitros", "esencia", "gotas"],
  },

  // 📏 LONGITUD (Estándar - No solicita rendimiento adicional)
  {
    id: "m-cm",
    name: "Metros a Centímetros (m → cm)",
    shortLabel: "Metros (m)",
    category: "longitud",
    purchaseUnit: "m",
    useUnit: "cm",
    defaultFactor: 100,
    isStandard: true,
    example: "1 metro = 100 cm de cinta, elástico o tela",
    keywords: ["m", "metro", "metros", "cm", "centimetros", "cinta", "tela", "hilo", "cordon", "longitud"],
  },
  {
    id: "m-mm",
    name: "Metros a Milímetros (m → mm)",
    shortLabel: "Metros (m) → mm",
    category: "longitud",
    purchaseUnit: "m",
    useUnit: "mm",
    defaultFactor: 1000,
    isStandard: true,
    example: "1 metro = 1.000 mm de alambre o tanza",
    keywords: ["m", "metro", "metros", "mm", "milimetros", "alambre"],
  },
  {
    id: "cm-cm",
    name: "Centímetros directos (cm → cm)",
    shortLabel: "Centímetros (cm)",
    category: "longitud",
    purchaseUnit: "cm",
    useUnit: "cm",
    defaultFactor: 1,
    isStandard: true,
    example: "1 cm = 1 cm directo",
    keywords: ["cm", "centimetro", "centimetros"],
  },

  // 📐 SUPERFICIE (Estándar - No solicita rendimiento adicional)
  {
    id: "m2-cm2",
    name: "Metros cuadrados a cm² (m² → cm²)",
    shortLabel: "Metros cuadrados (m²)",
    category: "superficie",
    purchaseUnit: "m2",
    useUnit: "cm2",
    defaultFactor: 10000,
    isStandard: true,
    example: "1 m² = 10.000 cm² de tela, vinilo o madera",
    keywords: ["m2", "m²", "metro cuadrado", "metros cuadrados", "superficie", "cm2", "cm²", "vinilo", "tela"],
  },
  {
    id: "m2-m2",
    name: "Metros cuadrados directos (m² → m²)",
    shortLabel: "Metros cuadrados (m² directos)",
    category: "superficie",
    purchaseUnit: "m2",
    useUnit: "m2",
    defaultFactor: 1,
    isStandard: true,
    example: "1 m² = 1 m² directo",
    keywords: ["m2", "m²", "plancha"],
  },
  {
    id: "cm2-cm2",
    name: "Centímetros cuadrados directos (cm² → cm²)",
    shortLabel: "Centímetros cuadrados (cm²)",
    category: "superficie",
    purchaseUnit: "cm2",
    useUnit: "cm2",
    defaultFactor: 1,
    isStandard: true,
    example: "1 cm² = 1 cm² directo",
    keywords: ["cm2", "cm²", "sticker", "recorte"],
  },

  // 📦 UNIDADES FIJAS POR DEFINICIÓN (Omitir pregunta de rendimiento)
  {
    id: "docena-u",
    name: "Docena (12 unidades fijas)",
    shortLabel: "Docena (12 unidades)",
    category: "unidad",
    purchaseUnit: "docena",
    useUnit: "u",
    defaultFactor: 12,
    isStandard: true, // Fija por definición (12 unidades)
    example: "1 docena = 12 unidades fijas (no requiere ingresar rendimiento)",
    keywords: ["docena", "docenas", "12", "doc", "botones", "flores"],
  },
  {
    id: "u-u",
    name: "Unidad directa (u → u)",
    shortLabel: "Unidad individual (u)",
    category: "unidad",
    purchaseUnit: "u",
    useUnit: "u",
    defaultFactor: 1,
    isStandard: true, // Fija por definición
    example: "1 unidad = 1 uso directo (frascos, dijes, sobres)",
    keywords: ["u", "unidad", "unidades", "un", "c/u", "frasco", "dije", "sobre", "broche"],
  },

  // 📦 EMPAQUES CON PREGUNTAS CONDICIONALES DINÁMICAS
  {
    id: "resma-hoja",
    name: "Resma → Hojas (resma → hojas)",
    shortLabel: "Resma (hojas)",
    category: "unidad",
    purchaseUnit: "resma",
    useUnit: "hojas",
    defaultFactor: 500,
    isStandard: false,
    promptQuestion: "¿Cuántas hojas contiene la resma?",
    promptPlaceholder: "500",
    example: "Ej: 1 resma de 500 hojas A4, Carta u Oficio",
    keywords: ["resma", "resmas", "papel", "hoja", "hojas", "a4", "carta", "oficio", "fotocopia"],
  },
  {
    id: "caja-u",
    name: "Caja → Unidades (caja → u)",
    shortLabel: "Caja (unidades)",
    category: "unidad",
    purchaseUnit: "caja",
    useUnit: "u",
    defaultFactor: 100,
    isStandard: false,
    promptQuestion: "¿Cuántas unidades contiene la caja?",
    promptPlaceholder: "100",
    example: "Ej: 1 caja con 100 frascos, tapas o cajas de envío",
    keywords: ["caja", "cajas", "box", "unidades", "envases", "tapas"],
  },
  {
    id: "bulto-u",
    name: "Bulto → Unidades (bulto → u)",
    shortLabel: "Bulto (unidades)",
    category: "unidad",
    purchaseUnit: "bulto",
    useUnit: "u",
    defaultFactor: 50,
    isStandard: false,
    promptQuestion: "¿Cuántas unidades contiene el bulto?",
    promptPlaceholder: "50",
    example: "Ej: 1 bulto cerrado con 50 artículos mayoristas",
    keywords: ["bulto", "bultos", "mayorista", "paqueton"],
  },
  {
    id: "pack-u",
    name: "Paquete / Pack → Unidades (paquete → u)",
    shortLabel: "Paquete / Pack (unidades)",
    category: "unidad",
    purchaseUnit: "paquete",
    useUnit: "u",
    defaultFactor: 20,
    isStandard: false,
    promptQuestion: "¿Cuántas unidades contiene el paquete?",
    promptPlaceholder: "20",
    example: "Ej: 1 paquete con 20 bolsas, etiquetas o moños",
    keywords: ["paquete", "paquetes", "pack", "packs", "bolsa", "etiquetas", "bolsas"],
  },
  {
    id: "pliego-hoja",
    name: "Pliego → Hojas / Partes (pliego → hojas)",
    shortLabel: "Pliego (hojas / partes)",
    category: "unidad",
    purchaseUnit: "pliego",
    useUnit: "hojas",
    defaultFactor: 4,
    isStandard: false,
    promptQuestion: "¿Cuántas hojas o partes rinde el pliego?",
    promptPlaceholder: "4",
    example: "Ej: 1 pliego de cartulina que rinde 4 hojas A5",
    keywords: ["pliego", "pliegos", "cartulina", "papel misionero"],
  },
  {
    id: "custom",
    name: "⚙️ Ajuste Manual / Personalizado",
    shortLabel: "Personalizado (manual)",
    category: "unidad",
    purchaseUnit: "unidad",
    useUnit: "unidad",
    defaultFactor: 1,
    isStandard: false,
    promptQuestion: "¿Cuánto rinde por cada unidad de compra?",
    promptPlaceholder: "1",
    example: "Definí manualmente la unidad de uso y el rendimiento",
    keywords: ["personalizado", "manual", "custom", "otro"],
  },
];

export function normalizeUnit(u?: string | null): string {
  return (u || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/²/g, "2")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Busca el preset más adecuado para una unidad de compra ingresada.
 */
export function findMatchingPreset(purchaseUnit?: string | null, useUnit?: string | null): UnitPreset | undefined {
  const normPurchase = normalizeUnit(purchaseUnit);
  if (!normPurchase) return undefined;

  // 1. Coincidencia exacta de purchaseUnit y useUnit si fue provista
  if (useUnit) {
    const normUse = normalizeUnit(useUnit);
    const exact = UNIT_PRESETS.find(
      (p) => normalizeUnit(p.purchaseUnit) === normPurchase && normalizeUnit(p.useUnit) === normUse
    );
    if (exact) return exact;
  }

  // 2. Coincidencia por purchaseUnit
  const byPurchase = UNIT_PRESETS.find((p) => normalizeUnit(p.purchaseUnit) === normPurchase);
  if (byPurchase) return byPurchase;

  // 3. Coincidencia por palabras clave
  const byKeyword = UNIT_PRESETS.find((p) =>
    p.keywords.some((kw) => normalizeUnit(kw) === normPurchase)
  );
  if (byKeyword) return byKeyword;

  return undefined;
}

export function calculateUnitCost(
  currentPrice: number,
  purchaseQuantity: number,
  conversionFactor: number
): number {
  const totalUseUnits = purchaseQuantity * conversionFactor;
  if (!totalUseUnits || totalUseUnits <= 0) return 0;
  return currentPrice / totalUseUnits;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
