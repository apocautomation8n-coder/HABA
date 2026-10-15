/**
 * Utilidades y Tipos para Preferencias de Formato Numérico y Moneda por Usuaria (T4)
 */

export interface FormatPrefs {
  currency: string;
  numberLocale: string;
  decimals: number;
}

export const DEFAULT_FORMAT_PREFS: FormatPrefs = {
  currency: "ARS",
  numberLocale: "es-AR",
  decimals: 2,
};

export interface CountryPreset {
  countryCode: string;
  countryName: string;
  currency: string;
  numberLocale: string;
  decimals: number;
  flag: string;
  example: string;
}

export const COUNTRY_PRESETS: CountryPreset[] = [
  {
    countryCode: "AR",
    countryName: "Argentina",
    currency: "ARS",
    numberLocale: "es-AR",
    decimals: 2,
    flag: "🇦🇷",
    example: "$ 1.234,50",
  },
  {
    countryCode: "MX",
    countryName: "México",
    currency: "MXN",
    numberLocale: "es-MX",
    decimals: 2,
    flag: "🇲🇽",
    example: "$1,234.50",
  },
  {
    countryCode: "CL",
    countryName: "Chile",
    currency: "CLP",
    numberLocale: "es-CL",
    decimals: 0,
    flag: "🇨🇱",
    example: "$ 1.235",
  },
  {
    countryCode: "US",
    countryName: "Estados Unidos (USD)",
    currency: "USD",
    numberLocale: "en-US",
    decimals: 2,
    flag: "🇺🇸",
    example: "$1,234.50",
  },
  {
    countryCode: "CO",
    countryName: "Colombia",
    currency: "COP",
    numberLocale: "es-CO",
    decimals: 0,
    flag: "🇨🇴",
    example: "$ 1.235",
  },
  {
    countryCode: "UY",
    countryName: "Uruguay",
    currency: "UYU",
    numberLocale: "es-UY",
    decimals: 2,
    flag: "🇺🇾",
    example: "$ 1.234,50",
  },
  {
    countryCode: "ES",
    countryName: "España (EUR)",
    currency: "EUR",
    numberLocale: "es-ES",
    decimals: 2,
    flag: "🇪🇸",
    example: "1.234,50 €",
  },
  {
    countryCode: "PE",
    countryName: "Perú",
    currency: "PEN",
    numberLocale: "es-PE",
    decimals: 2,
    flag: "🇵🇪",
    example: "S/ 1,234.50",
  },
];

/**
 * Formatea un valor monetario según las preferencias de moneda, locale y decimales.
 */
export function formatMoney(
  amount: number | null | undefined,
  override?: Partial<FormatPrefs>
): string {
  const num = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const currency = override?.currency || DEFAULT_FORMAT_PREFS.currency;
  const numberLocale = override?.numberLocale || DEFAULT_FORMAT_PREFS.numberLocale;
  const decimals =
    typeof override?.decimals === "number" ? override.decimals : DEFAULT_FORMAT_PREFS.decimals;

  try {
    return new Intl.NumberFormat(numberLocale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    // Fallback defensivo si el browser no soporta algún código ISO o locale no estándar
    try {
      return new Intl.NumberFormat(DEFAULT_FORMAT_PREFS.numberLocale, {
        style: "currency",
        currency: DEFAULT_FORMAT_PREFS.currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    } catch {
      return `$ ${num.toFixed(decimals)}`;
    }
  }
}

export interface FormatNumberOptions {
  decimals?: number;
  minDecimals?: number;
  maxDecimals?: number;
  locale?: string;
}

/**
 * Formatea una cantidad o dimensión numérica según el locale del usuario.
 */
export function formatNumber(
  value: number | null | undefined,
  options?: FormatNumberOptions,
  fallbackLocale: string = DEFAULT_FORMAT_PREFS.numberLocale
): string {
  const num = typeof value === "number" && !isNaN(value) ? value : 0;
  const locale = options?.locale || fallbackLocale;
  const minDec =
    typeof options?.minDecimals === "number"
      ? options.minDecimals
      : typeof options?.decimals === "number"
      ? options.decimals
      : 0;
  const maxDec =
    typeof options?.maxDecimals === "number"
      ? options.maxDecimals
      : typeof options?.decimals === "number"
      ? options.decimals
      : 4;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    }).format(num);
  } catch {
    return num.toLocaleString();
  }
}

/**
 * Parsea un número escrito por la usuaria respetando el separador decimal de su locale.
 * - En es-MX / en-US: el separador decimal es "." y los miles ",", ej. "1,234.50" -> 1234.5
 * - En es-AR / es-CL / es-ES: el separador decimal es "," y los miles ".", ej. "1.234,50" -> 1234.5
 * - Soporta entradas directas de teclado numérico (ej. "12.5" sin comas) sin romper.
 */
export function parseNumber(
  input: string | number | null | undefined,
  localeOrPrefs?: string | Partial<FormatPrefs>
): number {
  if (typeof input === "number") return isNaN(input) ? 0 : input;
  if (!input) return 0;
  let str = String(input).trim();
  if (str === "") return 0;

  const locale =
    typeof localeOrPrefs === "string"
      ? localeOrPrefs
      : localeOrPrefs?.numberLocale || DEFAULT_FORMAT_PREFS.numberLocale;

  const isDotDecimal = locale.startsWith("es-MX") || locale.startsWith("en");

  if (isDotDecimal) {
    // Miles es coma, decimal es punto (México, EE.UU.)
    str = str.replace(/,/g, "");
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  } else {
    // Miles es punto, decimal es coma (Argentina, Chile, etc.)
    if (str.includes(",")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Si tiene puntos y encaja en formato de miles tradicional (ej. "1.000" o "18.000" o "1.234.567")
      if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        str = str.replace(/\./g, "");
      }
      // De lo contrario (ej. "12.5" o "0.5"), el punto proviene de un numpad y se interpreta como decimal
    }
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  }
}

/**
 * Redondea totales de presupuestos para monedas sin decimales (ej. Chile / CLP).
 * No afecta costos internos de recetas ni insumos.
 */
export function roundQuoteTotal(amount: number, decimals: number = 2): number {
  if (decimals === 0) {
    return Math.round(amount);
  }
  return parseFloat(amount.toFixed(decimals));
}
