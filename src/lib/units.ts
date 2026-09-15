export interface UnitPreset {
  id: string;
  name: string;
  category: "peso" | "longitud" | "superficie" | "volumen" | "unidad";
  purchaseUnit: string;
  useUnit: string;
  defaultFactor: number; // Cuántas useUnit hay en 1 purchaseUnit
  example: string;
}

export const UNIT_PRESETS: UnitPreset[] = [
  {
    id: "kg-g",
    name: "Kilos a Gramos (kg → g)",
    category: "peso",
    purchaseUnit: "kg",
    useUnit: "g",
    defaultFactor: 1000,
    example: "Ej: 1 kg de cera, harina o resina = 1000 g",
  },
  {
    id: "g-g",
    name: "Gramos a Gramos (g → g)",
    category: "peso",
    purchaseUnit: "g",
    useUnit: "g",
    defaultFactor: 1,
    example: "Ej: Pote de 250 g = 250 g",
  },
  {
    id: "g-mg",
    name: "Gramos a Miligramos (g → mg)",
    category: "peso",
    purchaseUnit: "g",
    useUnit: "mg",
    defaultFactor: 1000,
    example: "Ej: Pigmento de 5 g = 5000 mg",
  },
  {
    id: "m-cm",
    name: "Metros a Centímetros (m → cm)",
    category: "longitud",
    purchaseUnit: "m",
    useUnit: "cm",
    defaultFactor: 100,
    example: "Ej: Rollo de 10 m de cinta o tela = 1000 cm",
  },
  {
    id: "m-mm",
    name: "Metros a Milímetros (m → mm)",
    category: "longitud",
    purchaseUnit: "m",
    useUnit: "mm",
    defaultFactor: 1000,
    example: "Ej: Alambre o hilo por metro = 1000 mm",
  },
  {
    id: "cm-cm",
    name: "Centímetros a Centímetros (cm → cm)",
    category: "longitud",
    purchaseUnit: "cm",
    useUnit: "cm",
    defaultFactor: 1,
    example: "Ej: Tira de 50 cm",
  },
  {
    id: "m2-cm2",
    name: "Metros cuadrados a Centímetros cuadrados (m² → cm²)",
    category: "superficie",
    purchaseUnit: "m²",
    useUnit: "cm²",
    defaultFactor: 10000,
    example: "Ej: 1 m² de vinilo, cuero o madera = 10.000 cm²",
  },
  {
    id: "m2-m2",
    name: "Metros cuadrados directos (m² → m²)",
    category: "superficie",
    purchaseUnit: "m²",
    useUnit: "m²",
    defaultFactor: 1,
    example: "Ej: Plancha de 1 m² = 1 m²",
  },
  {
    id: "cm2-cm2",
    name: "Centímetros cuadrados directos (cm² → cm²)",
    category: "superficie",
    purchaseUnit: "cm²",
    useUnit: "cm²",
    defaultFactor: 1,
    example: "Ej: Recorte o sticker de 100 cm²",
  },
  {
    id: "l-ml",
    name: "Litros a Mililitros (l → ml)",
    category: "volumen",
    purchaseUnit: "l",
    useUnit: "ml",
    defaultFactor: 1000,
    example: "Ej: Botella de 1 litro = 1000 ml",
  },
  {
    id: "ml-ml",
    name: "Mililitros directos (ml → ml)",
    category: "volumen",
    purchaseUnit: "ml",
    useUnit: "ml",
    defaultFactor: 1,
    example: "Ej: Esencia de 30 ml = 30 ml",
  },
  {
    id: "docena-u",
    name: "Docena a Unidades (docena → u)",
    category: "unidad",
    purchaseUnit: "docena",
    useUnit: "u",
    defaultFactor: 12,
    example: "Ej: 1 docena de botones = 12 unidades",
  },
  {
    id: "pack-u",
    name: "Paquete a Unidades (pack → u)",
    category: "unidad",
    purchaseUnit: "pack",
    useUnit: "u",
    defaultFactor: 1,
    example: "Ej: Pack de 50 cajas o 100 etiquetas",
  },
  {
    id: "u-u",
    name: "Unidad directa (u → u)",
    category: "unidad",
    purchaseUnit: "u",
    useUnit: "u",
    defaultFactor: 1,
    example: "Ej: 1 frasco de vidrio, 1 dije, 1 sobre",
  },
  {
    id: "pliego-hoja",
    name: "Pliego a Hojas / Partes (pliego → hojas)",
    category: "unidad",
    purchaseUnit: "pliego",
    useUnit: "hoja",
    defaultFactor: 1,
    example: "Ej: Pliego de papel que rinde 4 hojas A5",
  },
  {
    id: "custom",
    name: "⚙️ Personalizado (definir manualmente)",
    category: "unidad",
    purchaseUnit: "unidad",
    useUnit: "unidad",
    defaultFactor: 1,
    example: "Personalizá tus unidades y factor de rendimiento",
  },
];

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
