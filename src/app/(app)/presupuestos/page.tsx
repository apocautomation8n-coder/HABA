"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Calendar,
  User,
  Phone,
  Share2,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
  Edit2,
  Eye,
  X,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { matchesSearch } from "@/lib/search";
import { formatCurrency } from "@/lib/units";

interface QuoteItem {
  id: string;
  product_name: string;
  channel_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface Quote {
  id: string;
  quote_number: string | number;
  client_name: string;
  client_contact?: string;
  delivery_date?: string;
  discount_percent: number;
  subtotal: number;
  total: number;
  notes?: string;
  created_at: string;
  quote_items?: QuoteItem[];
}

interface UserProfile {
  business_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  instagram?: string | null;
  address?: string | null;
}

export default function PresupuestosPage() {
  const supabase = createClient();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          quote_items (*)
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setQuotes(data as Quote[]);
      }
    } catch (err) {
      console.error("Error loading quotes:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let pData: any = null;
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("business_name, full_name, email, phone, business_phone, business_email, instagram, address")
            .eq("id", user.id)
            .maybeSingle();
          pData = profileData;
        } catch {
          const { data: baseData } = await supabase
            .from("profiles")
            .select("business_name, full_name, email")
            .eq("id", user.id)
            .maybeSingle();
          pData = baseData;
        }

        const meta = user.user_metadata || {};
        pData = {
          ...(pData || {}),
          business_name: pData?.business_name || meta.business_name || null,
          full_name: pData?.full_name || meta.full_name || null,
          phone: pData?.business_phone || pData?.phone || meta.business_phone || meta.phone || null,
          business_phone: pData?.business_phone || meta.business_phone || meta.phone || null,
          business_email: pData?.business_email || meta.business_email || null,
          instagram: pData?.instagram || meta.instagram || null,
          address: pData?.address || meta.address || null,
        };
        setUserProfile(pData);
      }
    } catch (err) {
      console.error("Error loading profile for quotes:", err);
    }
  };

  useEffect(() => {
    loadQuotes();
    loadUserProfile();
  }, []);

  const handleDelete = async (quote: Quote) => {
    const confirmDelete = window.confirm(
      `¿Estás segura de eliminar el presupuesto ${quote.quote_number} para "${quote.client_name}"?`
    );
    if (!confirmDelete) return;

    try {
      await supabase.from("quote_items").delete().eq("quote_id", quote.id);
      const { error } = await supabase.from("quotes").delete().eq("id", quote.id);

      if (!error) {
        setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
      } else {
        alert("No se pudo eliminar el presupuesto: " + error.message);
      }
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  // Generar mensaje y compartir por Web Share API / WhatsApp
  const shareViaWhatsApp = async (quote: Quote) => {
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

    const notesText = quote.notes ? `\n\n📝 *Condiciones / Notas:*\n${quote.notes}` : "";

    // Datos de contacto del emprendimiento para el mensaje
    const contactLines: string[] = [];
    const bName = userProfile?.business_name || (userProfile?.full_name ? `Taller ${userProfile.full_name}` : "");
    if (bName) contactLines.push(`🌸 *${bName}*`);
    if (userProfile?.business_phone || userProfile?.phone) {
      contactLines.push(`📞 WhatsApp: ${userProfile.business_phone || userProfile.phone}`);
    }
    if (userProfile?.instagram) {
      contactLines.push(`📷 Instagram: ${userProfile.instagram}`);
    }
    if (userProfile?.business_email || userProfile?.email) {
      contactLines.push(`✉️ Email: ${userProfile.business_email || userProfile.email}`);
    }
    if (userProfile?.address) {
      contactLines.push(`📍 Ubicación: ${userProfile.address}`);
    }

    const contactFooter = contactLines.length > 0
      ? `\n\n💬 *Contacto:*\n${contactLines.join("\n")}`
      : "";

    const fullMessage =
      `*PRESUPUESTO #${quote.quote_number}* 🌸\n\n` +
      `*Cliente:* ${quote.client_name}\n` +
      `*Emisión:* ${new Date(quote.created_at).toLocaleDateString("es-AR")}\n\n` +
      `*Detalle de Productos:*\n${itemsText}\n\n` +
      `*Subtotal:* ${formatCurrency(quote.subtotal)}${discountText}\n` +
      `*TOTAL FINAL:* ${formatCurrency(quote.total)}${notesText}\n\n` +
      `⏳ *Vigencia:* 15 días corridos con precios congelados.` +
      contactFooter +
      `\n\n¡Muchas gracias por tu consulta!`;

    // 1. Intentar con Web Share API primero si el navegador lo soporta
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Presupuesto #${quote.quote_number} - ${quote.client_name}`,
          text: fullMessage,
        });
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          return;
        }
        console.warn("Web Share API no disponible, usando WhatsApp directo:", err);
      }
    }

    // 2. Fallback a WhatsApp Web / App
    const phoneClean = quote.client_contact?.replace(/[^0-9]/g, "") || "";
    const encodedText = encodeURIComponent(fullMessage);
    const waUrl = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(waUrl, "_blank");
  };

  // Descarga / Impresión nativa como PDF en formato A4 ajustado a una sola hoja
  const printQuote = (quote: Quote) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsRows = (quote.quote_items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 5px 8px; border-bottom: 1px solid #f0f0f0; font-weight: 600; color: #1f2937;">${item.product_name}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #f0f0f0; text-align: center; font-weight: 700; color: #374151;">${item.quantity}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #4b5563;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 800; color: #1F7A4C;">${formatCurrency(item.subtotal)}</td>
        </tr>
      `
      )
      .join("");

    const discountAmount =
      quote.discount_percent > 0 ? (quote.subtotal * quote.discount_percent) / 100 : 0;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Presupuesto #${quote.quote_number} - ${quote.client_name}</title>
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
            }
            .sheet {
              width: 100%;
              max-width: 100%;
              border: 1.5px solid #d1d5db;
              border-radius: 12px;
              padding: 14px 18px;
              margin: 0 auto;
              break-inside: avoid;
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1.5px solid #EAF0E8;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .brand-title {
              font-size: 20px;
              font-weight: 900;
              color: #1F7A4C;
              letter-spacing: -0.5px;
              margin: 0;
            }
            .brand-sub {
              font-size: 11px;
              color: #555;
              margin: 2px 0 0;
            }
            .quote-badge {
              display: inline-block;
              font-size: 9.5px;
              font-weight: 800;
              text-transform: uppercase;
              background: #DCF4D7;
              color: #1F7A4C;
              border: 1px solid #C3EBC0;
              padding: 2px 8px;
              border-radius: 999px;
            }
            .quote-num {
              font-size: 15px;
              font-weight: 900;
              color: #1a1a1a;
              margin: 2px 0 0;
            }
            .client-card {
              background: #F8FAF8;
              border: 1px solid #EAF0E8;
              border-radius: 10px;
              padding: 8px 12px;
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 11.5px;
            }
            .client-title {
              font-size: 9.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #888;
              margin-bottom: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
              margin-bottom: 8px;
              border-radius: 8px;
              overflow: hidden;
            }
            th {
              background: #DCF4D7;
              color: #1F7A4C;
              padding: 5px 8px;
              text-align: left;
              font-size: 10.5px;
              font-weight: 700;
              border-bottom: 1px solid #C3EBC0;
            }
            td {
              padding: 4px 8px;
              font-size: 11px;
              border-bottom: 1px solid #f0f0f0;
            }
            .totals-wrap {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 12px;
              margin-top: 6px;
            }
            .guarantee-box {
              background: #F0FAF4;
              border: 1px solid #DCF4D7;
              border-radius: 10px;
              padding: 6px 10px;
              font-size: 10px;
              color: #1F7A4C;
              max-width: 300px;
            }
            .totals-table {
              width: 250px;
              font-size: 11.5px;
            }
            .totals-table tr td {
              padding: 2px 4px;
              border: none;
            }
            .total-final-box {
              background: #DCF4D7;
              border: 1px solid #C3EBC0;
              border-radius: 10px;
              padding: 6px 10px;
              margin-top: 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #1F7A4C;
              font-weight: 900;
              font-size: 15px;
            }
            .notes-box {
              background: #FFFDF5;
              border: 1px solid #FEF3C7;
              border-radius: 10px;
              padding: 6px 10px;
              font-size: 10.5px;
              color: #78350F;
              margin-top: 6px;
            }
            .footer {
              border-top: 1px solid #eee;
              padding-top: 6px;
              margin-top: 8px;
              font-size: 9.5px;
              color: #777;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <h1 class="brand-title">${userProfile?.business_name || "HABA"}</h1>
                <p class="brand-sub">${userProfile?.full_name ? `Taller de ${userProfile.full_name}` : "Costos & Presupuestos"}</p>
                <div style="font-size: 10px; color: #555; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 8px;">
                  ${(userProfile?.business_phone || userProfile?.phone) ? `<span>📞 ${userProfile.business_phone || userProfile.phone}</span>` : ""}
                  ${(userProfile?.business_email || userProfile?.email) ? `<span>✉️ ${userProfile.business_email || userProfile.email}</span>` : ""}
                  ${userProfile?.instagram ? `<span>📷 ${userProfile.instagram}</span>` : ""}
                  ${userProfile?.address ? `<span>📍 ${userProfile.address}</span>` : ""}
                </div>
              </div>
              <div style="text-align: right;">
                <span class="quote-badge">Presupuesto Oficial</span>
                <p class="quote-num">N° #${String(quote.quote_number).padStart(4, "0")}</p>
                <p style="margin: 2px 0 0; font-size: 10.5px; color: #666;">
                  Emisión: ${new Date(quote.created_at).toLocaleDateString("es-AR")}
                  ${quote.delivery_date ? ` • Entrega: ${new Date(quote.delivery_date).toLocaleDateString("es-AR")}` : ""}
                </p>
              </div>
            </div>

            <div class="client-card">
              <div>
                <div class="client-title">Preparado para:</div>
                <strong style="font-size: 12.5px; color: #111;">${quote.client_name}</strong>
                ${quote.client_contact ? `<div style="color: #666; font-size: 10.5px; margin-top: 1px;">${quote.client_contact}</div>` : ""}
              </div>
              <div style="text-align: right;">
                <div class="client-title">Condiciones:</div>
                <div style="color: #1F7A4C; font-weight: 700;">Vigencia: 15 días corridos</div>
                <div style="color: #666; font-size: 10px; margin-top: 1px;">Precios Congelados</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Producto / Ítem</th>
                  <th style="text-align: center;">Cant.</th>
                  <th style="text-align: right;">Precio Unit.</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="totals-wrap">
              <div class="guarantee-box">
                <strong style="display: block; margin-bottom: 2px;">Precios Congelados</strong>
                Los valores quedan asegurados durante el período de vigencia de 15 días corridos.
              </div>

              <div class="totals-table">
                <table style="margin: 0; width: 100%;">
                  <tbody>
                    <tr>
                      <td style="color: #666;">Subtotal:</td>
                      <td style="text-align: right; font-weight: 600;">${formatCurrency(quote.subtotal)}</td>
                    </tr>
                    ${discountAmount > 0 ? `
                    <tr>
                      <td style="color: #b91c1c;">Descuento (${quote.discount_percent}%):</td>
                      <td style="text-align: right; color: #b91c1c; font-weight: 600;">-${formatCurrency(discountAmount)}</td>
                    </tr>` : ""}
                  </tbody>
                </table>

                <div class="total-final-box">
                  <span style="font-size: 10px; text-transform: uppercase;">Total Final:</span>
                  <span>${formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>

            ${quote.notes ? `
            <div class="notes-box">
              <strong>📝 Condiciones de entrega y formas de pago:</strong><br/>
              <span style="white-space: pre-line; line-height: 1.4;">${quote.notes}</span>
            </div>` : ""}

            <div class="footer">
              <span>Vigencia: 15 días corridos con precios congelados.</span>
              <span style="color: #1F7A4C; font-weight: 600;">Generado con HABA • Presupuesto Oficial</span>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    return quotes.filter((q) =>
      matchesSearch([q.client_name, q.quote_number, q.notes], search)
    );
  }, [quotes, search]);

  return (
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <span>Presupuestos</span>
            <span className="text-xs bg-[#DCF4D7] text-[#1F7A4C] font-semibold px-2 py-0.5 rounded-full">
              {quotes.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-500">Cotizaciones profesionales y PDF para clientes</p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="p-2.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo</span>
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o número..."
          className="w-full pl-10 pr-10 py-2.5 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none shadow-sm transition"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 transition"
            title="Borrar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Listado de Presupuestos o Estado Vacío */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Cargando tus presupuestos...
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              {search ? "No se encontraron presupuestos" : "No hay presupuestos emitidos"}
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              {search
                ? "Probá con otro nombre de cliente o número."
                : "Generá presupuestos congelando precios para enviarlos por WhatsApp o descargarlos en PDF."}
            </p>
          </div>
          {!search && (
            <Link
              href="/presupuestos/nuevo"
              className="mt-2 py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Armar primer presupuesto</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote) => {
            const isExpanded = expandedQuoteId === quote.id;

            return (
              <div
                key={quote.id}
                className="bg-white rounded-3xl p-4 border border-[#EAF0E8] shadow-sm flex flex-col space-y-3 transition hover:border-[#C3EBC0]"
              >
                {/* Cabecera del presupuesto */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full">
                        {quote.quote_number}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(quote.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-800 mt-1">
                      {quote.client_name}
                    </h3>
                    {quote.client_contact && (
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {quote.client_contact}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-[#1F7A4C] block">
                      {formatCurrency(quote.total)}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      {quote.quote_items?.length || 0} ítems
                    </span>
                  </div>
                </div>

                {/* Acciones Rápidas: WhatsApp, PDF, Desplegar */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/presupuestos/${quote.id}`}
                      className="py-1.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs active:scale-95"
                      title="Ver vista previa oficial del presupuesto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Vista Previa</span>
                    </Link>

                    <button
                      onClick={() => shareViaWhatsApp(quote)}
                      className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Enviar por WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => printQuote(quote)}
                      className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Imprimir o Guardar PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    <Link
                      href={`/presupuestos/nuevo?edit=${quote.id}`}
                      className="py-1.5 px-3 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Editar este presupuesto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(quote)}
                      className="p-1.5 text-neutral-300 hover:text-rose-500 rounded-xl transition"
                      title="Eliminar presupuesto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Detalle Desplegado de Ítems Congelados */}
                {isExpanded && (
                  <div className="pt-2 border-t border-neutral-100 space-y-2 animate-in fade-in-50 duration-200">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Ítems Congelados en este Presupuesto:
                    </span>

                    <div className="space-y-1.5">
                      {quote.quote_items?.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-neutral-800 block">
                              {item.quantity}x {item.product_name}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              Canal: {item.channel_name} | Unit: {formatCurrency(item.unit_price)}
                            </span>
                          </div>
                          <span className="font-extrabold text-[#1F7A4C]">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {quote.notes && (
                      <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-[11px] text-amber-800">
                        <strong className="block">Notas:</strong>
                        {quote.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
