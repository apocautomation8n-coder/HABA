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
  avatar_url?: string | null;
  logo_url?: string | null;
  business_logo?: string | null;
  business_rubro?: string | null;
  rubro?: string | null;
  quote_primary_color?: string | null;
}

export interface QuoteThemeColor {
  id: string;
  name: string;
  primary: string;
  primaryDark: string;
  badgeBg: string;
  badgeBorder: string;
  totalBg: string;
  totalText: string;
}

export const QUOTE_COLOR_PALETTES: QuoteThemeColor[] = [
  {
    id: "emerald",
    name: "Verde Esmeralda",
    primary: "#10B981",
    primaryDark: "#065F46",
    badgeBg: "#ECFDF5",
    badgeBorder: "#A7F3D0",
    totalBg: "#DCF4D7",
    totalText: "#1F7A4C",
  },
  {
    id: "blue",
    name: "Azul Marino",
    primary: "#1D4ED8",
    primaryDark: "#1E40AF",
    badgeBg: "#EFF6FF",
    badgeBorder: "#BFDBFE",
    totalBg: "#DBEAFE",
    totalText: "#1D4ED8",
  },
  {
    id: "graphite",
    name: "Negro Grafito",
    primary: "#1F2937",
    primaryDark: "#111827",
    badgeBg: "#F3F4F6",
    badgeBorder: "#E5E7EB",
    totalBg: "#E5E7EB",
    totalText: "#111827",
  },
  {
    id: "rose",
    name: "Rosa / Bordó",
    primary: "#BE185D",
    primaryDark: "#9D174D",
    badgeBg: "#FDF2F8",
    badgeBorder: "#FBCFE8",
    totalBg: "#FCE7F3",
    totalText: "#BE185D",
  },
  {
    id: "terracotta",
    name: "Naranja / Terracota",
    primary: "#EA580C",
    primaryDark: "#C2410C",
    badgeBg: "#FFF7ED",
    badgeBorder: "#FED7AA",
    totalBg: "#FFEDD5",
    totalText: "#C2410C",
  },
];

export function getQuoteTheme(colorOrId?: string | null): QuoteThemeColor {
  if (!colorOrId) return QUOTE_COLOR_PALETTES[0];
  const normalized = colorOrId.trim().toLowerCase();
  const match = QUOTE_COLOR_PALETTES.find(
    (p) => p.id.toLowerCase() === normalized || p.primary.toLowerCase() === normalized
  );
  if (match) return match;
  return QUOTE_COLOR_PALETTES[0];
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

function escapeHtml(text?: string | number | null): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Genera el documento HTML completo para impresión nativa / PDF A4
 * con diseño profesional idéntico a la Vista Previa y branding del emprendimiento.
 */
export function generateQuotePrintHtml(
  quote: Quote,
  profile: UserProfile | null,
  validity?: QuoteValidityInfo,
  themeColor?: QuoteThemeColor
): string {
  const val = validity || getQuoteValidity(quote);
  const theme = themeColor || getQuoteTheme(profile?.quote_primary_color);
  const { cleanNotes, shippingCost } = parseQuoteNotes(quote.notes);

  const bName = profile?.business_name?.trim() || (profile?.full_name ? `Taller ${profile.full_name.trim()}` : "Presupuesto Comercial");
  const logoUrl = profile?.avatar_url || profile?.logo_url || profile?.business_logo || null;
  const rubroText = profile?.business_rubro?.trim() || profile?.rubro?.trim() || (profile?.full_name ? `Taller de ${profile.full_name.trim()}` : "");

  const phone = profile?.business_phone || profile?.phone;
  const email = profile?.business_email || profile?.email;
  const instagram = profile?.instagram;
  const address = profile?.address;

  const discountAmount =
    quote.discount_percent > 0 ? (quote.subtotal * quote.discount_percent) / 100 : 0;
  const finalShippingCost = shippingCost || (quote.shipping_cost ? Number(quote.shipping_cost) : 0);

  const formattedIssuedDate = new Date(quote.created_at).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const formattedDeliveryDate = quote.delivery_date
    ? new Date(quote.delivery_date).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const itemsRows = (quote.quote_items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #f0f0f0; font-weight: 700; color: #1f2937;">${escapeHtml(item.product_name)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #6b7280; font-size: 10px;">
          <span style="background: #f3f4f6; padding: 2px 6px; border-radius: 999px;">${escapeHtml(item.channel_name || "General")}</span>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; text-align: center; font-weight: 800; color: #374151;">${escapeHtml(item.quantity)}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #4b5563;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 900; color: ${theme.primaryDark || theme.primary};">${formatCurrency(item.subtotal)}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Presupuesto #${quote.quote_number} - ${escapeHtml(quote.client_name)}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
        body {
          margin: 0 !important;
          padding: 10mm 12mm !important;
        }
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 10mm 12mm;
        background: #ffffff;
        color: #1a1a1a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        width: 100%;
        line-height: 1.35;
      }
      .sheet {
        width: 100%;
        max-width: 100%;
        border: 1.5px solid #d1d5db;
        border-radius: 14px;
        padding: 16px 20px;
        margin: 0 auto;
        break-inside: avoid;
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1.5px solid #EAF0E8;
        padding-bottom: 10px;
        margin-bottom: 10px;
        gap: 16px;
      }
      .brand-title {
        font-size: 22px;
        font-weight: 900;
        color: #111827;
        letter-spacing: -0.5px;
        margin: 0;
        line-height: 1.15;
      }
      .brand-sub {
        font-size: 11.5px;
        font-weight: 600;
        color: #6b7280;
        margin: 2px 0 0;
      }
      .quote-badge {
        display: inline-block;
        font-size: 9.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: ${theme.badgeBg};
        color: ${theme.primaryDark || theme.primary};
        border: 1px solid ${theme.badgeBorder};
        padding: 3px 9px;
        border-radius: 999px;
      }
      .quote-num {
        font-size: 17px;
        font-weight: 900;
        color: #111827;
        margin: 3px 0 0;
      }
      .client-card {
        background: #F8FAF8;
        border: 1px solid #EAF0E8;
        border-radius: 12px;
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        font-size: 11.5px;
        gap: 12px;
      }
      .client-title {
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #9ca3af;
        margin-bottom: 2px;
      }
      .section-heading {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: ${theme.primaryDark || theme.primary};
        margin-bottom: 4px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
        margin-bottom: 10px;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid #EAF0E8;
      }
      th {
        background: ${theme.badgeBg};
        color: ${theme.primaryDark || theme.primary};
        padding: 6px 10px;
        text-align: left;
        font-size: 10.5px;
        font-weight: 800;
        border-bottom: 1px solid ${theme.badgeBorder};
      }
      td {
        padding: 5px 10px;
        font-size: 11px;
      }
      .totals-wrap {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 14px;
        margin-top: 6px;
      }
      .guarantee-box {
        background: ${theme.badgeBg};
        border: 1px solid ${theme.badgeBorder};
        border-radius: 12px;
        padding: 8px 12px;
        font-size: 10.5px;
        color: ${theme.primaryDark || theme.primary};
        max-width: 320px;
        line-height: 1.4;
      }
      .totals-table {
        width: 270px;
        font-size: 11.5px;
      }
      .totals-table tr td {
        padding: 2.5px 4px;
        border: none;
      }
      .total-final-box {
        background: ${theme.totalBg};
        border: 1px solid ${theme.badgeBorder};
        border-radius: 12px;
        padding: 8px 12px;
        margin-top: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: ${theme.totalText || theme.primary};
        font-weight: 900;
        font-size: 16px;
      }
      .notes-box {
        background: #FFFDF5;
        border: 1px solid #FEF3C7;
        border-radius: 12px;
        padding: 8px 12px;
        font-size: 10.5px;
        color: #78350F;
        margin-top: 8px;
        line-height: 1.45;
      }
      .footer {
        border-top: 1px solid #e5e7eb;
        padding-top: 8px;
        margin-top: 10px;
        font-size: 9.5px;
        color: #6b7280;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          ${
            logoUrl
              ? `<div style="display: flex; align-items: center; gap: 12px;">
                  <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(bName)}" style="max-height: 56px; max-width: 180px; width: auto; height: auto; object-fit: contain; border-radius: 8px;" />
                  <div>
                    <h1 class="brand-title">${escapeHtml(bName)}</h1>
                    ${rubroText ? `<p class="brand-sub">${escapeHtml(rubroText)}</p>` : ""}
                  </div>
                </div>`
              : `<div>
                  <h1 class="brand-title" style="font-size: 24px;">${escapeHtml(bName)}</h1>
                  ${rubroText ? `<p class="brand-sub">${escapeHtml(rubroText)}</p>` : ""}
                </div>`
          }
          <div style="font-size: 10px; color: #4b5563; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 10px;">
            ${phone ? `<span>📞 ${escapeHtml(phone)}</span>` : ""}
            ${email ? `<span>✉️ ${escapeHtml(email)}</span>` : ""}
            ${instagram ? `<span>📷 ${escapeHtml(instagram)}</span>` : ""}
            ${address ? `<span>📍 ${escapeHtml(address)}</span>` : ""}
          </div>
        </div>

        <div style="text-align: right; flex-shrink: 0;">
          <span class="quote-badge">Presupuesto Oficial</span>
          <p class="quote-num">N° #${String(quote.quote_number).padStart(4, "0")}</p>
          <p style="margin: 3px 0 0; font-size: 10.5px; color: #6b7280;">
            Emisión: <strong>${formattedIssuedDate}</strong>
            ${formattedDeliveryDate ? ` • Entrega: <strong>${formattedDeliveryDate}</strong>` : ""}
          </p>
        </div>
      </div>

      <div class="client-card">
        <div>
          <div class="client-title">Preparado para:</div>
          <strong style="font-size: 13px; color: #111827;">${escapeHtml(quote.client_name)}</strong>
          ${quote.client_contact ? `<div style="color: #4b5563; font-size: 10.5px; margin-top: 1px;">${escapeHtml(quote.client_contact)}</div>` : ""}
        </div>
        <div style="text-align: right;">
          <div class="client-title">Condiciones de la propuesta:</div>
          <div style="color: ${theme.primaryDark || theme.primary}; font-weight: 700;">Vigencia: ${val.validityDays} días corridos</div>
          <div style="color: #6b7280; font-size: 10px; margin-top: 1px;">Vence: <strong>${val.formattedValidUntil}</strong></div>
        </div>
      </div>

      <div class="section-heading">Detalle de Productos & Servicios</div>
      <table>
        <thead>
          <tr>
            <th>Producto / Ítem</th>
            <th style="text-align: center; width: 80px;">Canal</th>
            <th style="text-align: center; width: 60px;">Cant.</th>
            <th style="text-align: right; width: 95px;">Precio Unit.</th>
            <th style="text-align: right; width: 105px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || `<tr><td colspan="5" style="text-align: center; color: #9ca3af; padding: 14px;">Sin ítems registrados</td></tr>`}
        </tbody>
      </table>

      <div class="totals-wrap">
        <div class="guarantee-box">
          <strong style="display: block; margin-bottom: 2px;">Precios Congelados</strong>
          Los valores quedan asegurados hasta el ${val.formattedValidUntil} (${val.validityDays} días corridos desde su emisión).
        </div>

        <div class="totals-table">
          <table style="margin: 0; width: 100%; border: none;">
            <tbody>
              <tr>
                <td style="color: #6b7280;">Subtotal:</td>
                <td style="text-align: right; font-weight: 700; color: #1f2937;">${formatCurrency(quote.subtotal)}</td>
              </tr>
              ${discountAmount > 0 ? `
              <tr>
                <td style="color: #b91c1c;">Descuento (${quote.discount_percent}%):</td>
                <td style="text-align: right; color: #b91c1c; font-weight: 700;">-${formatCurrency(discountAmount)}</td>
              </tr>` : ""}
              ${finalShippingCost > 0 ? `
              <tr>
                <td style="color: ${theme.primaryDark || theme.primary};">Costo de Envío:</td>
                <td style="text-align: right; color: ${theme.primaryDark || theme.primary}; font-weight: 700;">+${formatCurrency(finalShippingCost)}</td>
              </tr>` : ""}
            </tbody>
          </table>

          <div class="total-final-box">
            <div>
              <span style="font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; display: block; opacity: 0.85;">Total Final</span>
              <span style="font-size: 8.5px; opacity: 0.75; display: block;">Presupuesto congelado</span>
            </div>
            <span>${formatCurrency(quote.total)}</span>
          </div>
          ${finalShippingCost > 0 ? `
          <p style="font-size: 9px; color: #9ca3af; text-align: right; font-style: italic; margin: 3px 0 0;">
            * Tarifa de envío cotizada sujeta a variación del correo.
          </p>` : ""}
        </div>
      </div>

      ${cleanNotes ? `
      <div class="notes-box">
        <strong style="display: block; margin-bottom: 2px;">📝 Condiciones de entrega y formas de pago:</strong>
        <span style="white-space: pre-line; line-height: 1.45; color: #4b5563;">${escapeHtml(cleanNotes)}</span>
      </div>` : ""}

      <div class="footer">
        <span>Cláusula de Vigencia: <strong>${val.formattedClause}</strong></span>
        <span>Emitido para <strong>${escapeHtml(quote.client_name)}</strong> • Documento Comercial Oficial</span>
      </div>
    </div>
    <script>
      window.onload = function() {
        window.print();
      };
    </script>
  </body>
</html>`;
}
