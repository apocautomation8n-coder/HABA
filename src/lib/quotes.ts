import { formatCurrency } from "@/lib/units";

export interface QuoteItem {
  id?: string;
  product_name: string;
  channel_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Quote {
  id: string;
  user_id?: string;
  quote_number: string | number;
  client_name: string;
  client_contact?: string | null;
  delivery_date?: string | null;
  discount_percent: number;
  subtotal: number;
  total: number;
  notes?: string | null;
  created_at: string;
  quote_items?: QuoteItem[];
  valid_until?: string | null;
  validity_days?: number | null;
  shipping_cost?: number | null;
}

export interface UserProfile {
  business_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  instagram?: string | null;
  address?: string | null;
}

export interface QuoteValidityInfo {
  validUntil: Date;
  validityDays: number;
  isExpired: boolean;
  daysRemaining: number;
  formattedValidUntil: string;
  formattedIssuedAt: string;
  formattedClause: string;
}

/**
 * Convierte un objeto Date a formato YYYY-MM-DD para inputs tipo date
 */
export function formatDateToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Suma días corridos a una fecha base
 */
export function addDays(baseDate: Date, days: number): Date {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calcula la diferencia en días corridos entre dos fechas (redondeado)
 */
export function computeDaysDiff(fromDate: Date, toDate: Date): number {
  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Extrae metadatos embebidos en `notes` ([ENVIO:X], [VALIDEZ:dias:ISO_DATE]) y devuelve notas limpias
 */
export function parseQuoteNotes(rawNotes?: string | null): {
  cleanNotes: string;
  shippingCost: number;
  validityDays: number | null;
  validUntil: string | null;
} {
  if (!rawNotes) {
    return {
      cleanNotes: "",
      shippingCost: 0,
      validityDays: null,
      validUntil: null,
    };
  }

  let text = rawNotes;
  let shippingCost = 0;
  let validityDays: number | null = null;
  let validUntil: string | null = null;

  // Extraer envío
  const shippingMatch = text.match(/\[ENVIO:(\d+(\.\d+)?)\]/);
  if (shippingMatch) {
    shippingCost = Number(shippingMatch[1]) || 0;
    text = text.replace(/\[ENVIO:(\d+(\.\d+)?)\]\n?/, "");
  }

  // Extraer validez [VALIDEZ:15:2026-10-06T00:00:00.000Z]
  const validityMatch = text.match(/\[VALIDEZ:(\d+):([^\]]+)\]/);
  if (validityMatch) {
    validityDays = parseInt(validityMatch[1], 10) || null;
    validUntil = validityMatch[2].trim() || null;
    text = text.replace(/\[VALIDEZ:(\d+):([^\]]+)\]\n?/, "");
  }

  return {
    cleanNotes: text.trim(),
    shippingCost,
    validityDays,
    validUntil,
  };
}

/**
 * Empaqueta metadatos ([ENVIO:X], [VALIDEZ:dias:ISO]) con las notas de usuario
 */
export function formatQuoteNotes(
  cleanNotes: string,
  shippingCost: number = 0,
  validity?: { days: number; validUntil: string }
): string | null {
  const parts: string[] = [];

  if (shippingCost > 0) {
    parts.push(`[ENVIO:${shippingCost}]`);
  }

  if (validity && validity.days > 0) {
    parts.push(`[VALIDEZ:${validity.days}:${validity.validUntil}]`);
  }

  if (cleanNotes.trim()) {
    parts.push(cleanNotes.trim());
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Calcula el estado de validez de un presupuesto
 */
export function getQuoteValidity(
  quote: {
    created_at?: string;
    valid_until?: string | null;
    validity_days?: number | null;
    notes?: string | null;
  },
  customNow?: Date
): QuoteValidityInfo {
  const now = customNow || new Date();
  const issuedDate = quote.created_at ? new Date(quote.created_at) : new Date();

  // Intentar obtener de columnas o de notas parseadas
  const parsed = parseQuoteNotes(quote.notes);
  const validityDays =
    quote.validity_days || parsed.validityDays || 15;

  let validUntilDate: Date;
  if (quote.valid_until) {
    validUntilDate = new Date(quote.valid_until);
  } else if (parsed.validUntil) {
    validUntilDate = new Date(parsed.validUntil);
  } else {
    validUntilDate = addDays(issuedDate, validityDays);
  }

  // Si la fecha resultante es inválida, fallback
  if (isNaN(validUntilDate.getTime())) {
    validUntilDate = addDays(issuedDate, 15);
  }

  // Considerar el fin del día límite de validez (23:59:59.999) para no vencer prematuramente
  const endOfValidDay = new Date(validUntilDate);
  endOfValidDay.setHours(23, 59, 59, 999);

  const isExpired = now.getTime() > endOfValidDay.getTime();
  const msRemaining = endOfValidDay.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  const formattedValidUntil = validUntilDate.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formattedIssuedAt = issuedDate.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formattedClause = `Presupuesto válido hasta el ${formattedValidUntil} (${validityDays} días corridos a partir de la fecha de emisión). Precios sujetos a modificación posterior.`;

  return {
    validUntil: validUntilDate,
    validityDays,
    isExpired,
    daysRemaining,
    formattedValidUntil,
    formattedIssuedAt,
    formattedClause,
  };
}

/**
 * Genera el texto estándar para compartir por WhatsApp
 */
export function buildQuoteWhatsAppMessage(
  quote: Quote,
  profile: UserProfile | null,
  validity?: QuoteValidityInfo
): string {
  const val = validity || getQuoteValidity(quote);
  const { cleanNotes, shippingCost } = parseQuoteNotes(quote.notes);

  const itemsText = (quote.quote_items || [])
    .map(
      (item) =>
        `• ${item.quantity}x ${item.product_name} (${formatCurrency(item.unit_price)}) = ${formatCurrency(
          item.subtotal
        )}`
    )
    .join("\n");

  const discountText =
    quote.discount_percent > 0
      ? `\n🏷️ Descuento (${quote.discount_percent}%): -${formatCurrency(
          (quote.subtotal * quote.discount_percent) / 100
        )}`
      : "";

  const finalShippingCost = shippingCost || (quote.shipping_cost ? Number(quote.shipping_cost) : 0);
  const shippingText =
    finalShippingCost > 0
      ? `\n🚚 Envío: ${formatCurrency(finalShippingCost)} (sujeto a tarifa del correo)`
      : "";

  const notesText = cleanNotes ? `\n\n📝 *Condiciones / Entrega:*\n${cleanNotes}` : "";

  // Datos de contacto del emprendimiento
  const contactLines: string[] = [];
  const bName = profile?.business_name || (profile?.full_name ? `Taller ${profile.full_name}` : "");
  if (bName) contactLines.push(`🌸 *${bName}*`);
  if (profile?.business_phone || profile?.phone) {
    contactLines.push(`📞 WhatsApp: ${profile.business_phone || profile.phone}`);
  }
  if (profile?.instagram) {
    contactLines.push(`📷 Instagram: ${profile.instagram}`);
  }
  if (profile?.business_email || profile?.email) {
    contactLines.push(`✉️ Email: ${profile.business_email || profile.email}`);
  }
  if (profile?.address) {
    contactLines.push(`📍 Ubicación: ${profile.address}`);
  }

  const contactFooter =
    contactLines.length > 0 ? `\n\n💬 *Contacto:*\n${contactLines.join("\n")}` : "";

  return (
    `*PRESUPUESTO #${quote.quote_number}* 🌸\n\n` +
    `*Cliente:* ${quote.client_name}\n` +
    `*Emisión:* ${val.formattedIssuedAt}\n\n` +
    `*Detalle de Productos:*\n${itemsText}\n\n` +
    `*Subtotal:* ${formatCurrency(quote.subtotal)}${discountText}${shippingText}\n` +
    `*TOTAL FINAL:* ${formatCurrency(quote.total)}${notesText}\n\n` +
    `⏳ *Presupuesto válido hasta el ${val.formattedValidUntil}* (${val.validityDays} días corridos a partir de la fecha de emisión). Precios sujetos a modificación posterior.` +
    contactFooter +
    `\n\n¡Muchas gracias por tu consulta!`
  );
}
