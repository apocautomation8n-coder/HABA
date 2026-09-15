"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Share2,
  Edit2,
  Calendar,
  User,
  Phone,
  Clock,
  Sparkles,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
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
  user_id: string;
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
}

interface UserProfile {
  business_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

export default function PresupuestoPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const supabase = createClient();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadQuoteAndProfile = async () => {
      try {
        setLoading(true);
        // 1. Cargar el presupuesto con sus ítems
        const { data: quoteData, error: quoteError } = await supabase
          .from("quotes")
          .select(`
            *,
            quote_items (*)
          `)
          .eq("id", id)
          .single();

        if (quoteError || !quoteData) {
          setErrorMsg("No se encontró el presupuesto solicitado.");
          return;
        }

        setQuote(quoteData as Quote);

        // 2. Cargar perfil del emisor para branding (taller / nombre)
        if (quoteData.user_id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("business_name, full_name, email")
            .eq("id", quoteData.user_id)
            .maybeSingle();

          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (err: any) {
        console.error("Error loading quote preview:", err);
        setErrorMsg(err.message || "Error al cargar la vista previa.");
      } finally {
        setLoading(false);
      }
    };

    loadQuoteAndProfile();
  }, [id, supabase]);

  // Extraer envío y notas limpias
  const shippingCost = React.useMemo(() => {
    if (!quote?.notes) return 0;
    const match = quote.notes.match(/\[ENVIO:(\d+(\.\d+)?)\]/);
    return match ? Number(match[1]) || 0 : 0;
  }, [quote?.notes]);

  const cleanNotes = React.useMemo(() => {
    if (!quote?.notes) return "";
    return quote.notes.replace(/\[ENVIO:(\d+(\.\d+)?)\]\n?/, "").trim();
  }, [quote?.notes]);

  // Compartir por WhatsApp / Web Share API
  const handleShareWhatsApp = async () => {
    if (!quote) return;

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

    const shippingText =
      shippingCost > 0
        ? `\n🚚 Envío: ${formatCurrency(shippingCost)} (sujeto a tarifa del correo)`
        : "";

    const notesText = cleanNotes
      ? `\n\n📝 *Condiciones / Entrega:*\n${cleanNotes}`
      : "";

    const fullMessage =
      `*PRESUPUESTO #${quote.quote_number}* 🌸\n\n` +
      `*Cliente:* ${quote.client_name}\n` +
      `*Emisión:* ${new Date(quote.created_at).toLocaleDateString("es-AR")}\n\n` +
      `*Detalle de Productos:*\n${itemsText}\n\n` +
      `*Subtotal:* ${formatCurrency(quote.subtotal)}${discountText}${shippingText}\n` +
      `*TOTAL FINAL:* ${formatCurrency(quote.total)}${notesText}\n\n` +
      `⏳ *Vigencia:* 15 días corridos con precios congelados.\n\n` +
      `¡Muchas gracias por tu consulta!`;

    // 1. Intentar con Web Share API (SIN url separada para evitar que WhatsApp duplique el enlace al final)
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
        console.warn("Web Share API fallback:", err);
      }
    }

    // 2. Fallback directo a WhatsApp Web / App
    const phoneClean = quote.client_contact?.replace(/[^0-9]/g, "") || "";
    const encodedText = encodeURIComponent(fullMessage);
    const waUrl = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(waUrl, "_blank");
  };

  // Imprimir / Descargar PDF nativo
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
        <HabaMascot size={60} className="animate-bounce" />
        <p className="text-xs text-neutral-400">Cargando vista previa del presupuesto...</p>
      </div>
    );
  }

  if (errorMsg || !quote) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3 max-w-md mx-auto my-12">
        <HabaMascot size={70} />
        <h3 className="text-sm font-bold text-neutral-800">Presupuesto no encontrado</h3>
        <p className="text-xs text-neutral-500">{errorMsg || "El presupuesto no existe o fue eliminado."}</p>
        <Link
          href="/presupuestos"
          className="mt-2 py-2 px-4 bg-[#3BB578] text-white text-xs font-bold rounded-2xl transition shadow-sm"
        >
          Volver a Presupuestos
        </Link>
      </div>
    );
  }

  const discountAmount =
    quote.discount_percent > 0 ? (quote.subtotal * quote.discount_percent) / 100 : 0;

  return (
    <div className="w-full flex flex-col space-y-4 pb-16">
      {/* Estilos específicos para impresión impecable en hoja A4 (Punto F) */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #1a1a1a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          main {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          header,
          nav,
          aside,
          .print-hidden,
          [role="navigation"] {
            display: none !important;
          }
          .quote-sheet {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            padding: 24px !important;
            margin: 0 auto !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 12px !important;
          }
        }
      `}</style>

      {/* Barra de Navegación y Acciones Rápidas (Oculta al Imprimir) */}
      <div className="flex items-center justify-between gap-2 flex-wrap print-hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/presupuestos"
            className="p-2 bg-white hover:bg-neutral-100 text-neutral-600 rounded-2xl border border-neutral-200 shadow-sm transition"
            title="Volver a presupuestos"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-800">
                Presupuesto #{quote.quote_number}
              </h2>
              <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                Precios Congelados
              </span>
            </div>
            <p className="text-xs text-neutral-500">Vista previa oficial para el cliente</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/presupuestos/nuevo?edit=${quote.id}`}
            className="py-2 px-3 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Editar este presupuesto"
          >
            <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
            <span>Editar</span>
          </Link>

          <button
            onClick={handleShareWhatsApp}
            className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
            title="Enviar por WhatsApp al cliente"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="py-2 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Imprimir o descargar como PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Hoja del Presupuesto con Branding HABA (Estructura de Documento A4) */}
      <div className="quote-sheet bg-white rounded-3xl p-6 sm:p-10 border border-[#EAF0E8] shadow-sm max-w-3xl mx-auto w-full space-y-6">
        {/* Cabecera Institucional y Branding (Puntos D y G) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#EAF0E8] pb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DCF4D7] border border-[#C3EBC0] flex items-center justify-center flex-shrink-0 shadow-2xs">
              <HabaMascot size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[#1F7A4C] tracking-tight">HABA</span>
                <span className="text-[10px] bg-[#F0FAF4] text-[#1F7A4C] border border-[#DCF4D7] px-2 py-0.5 rounded-full font-bold">
                  Costos & Presupuestos
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-medium">
                {profile?.business_name ? (
                  <strong className="text-neutral-800 font-bold">{profile.business_name}</strong>
                ) : profile?.full_name ? (
                  <span>Taller de <strong>{profile.full_name}</strong></span>
                ) : (
                  "Taller Artesanal & Confección"
                )}
              </p>
              {profile?.email && (
                <p className="text-[10.5px] text-neutral-400">{profile.email}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end items-start w-full sm:w-auto bg-[#F8FAF8] sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-[#EAF0E8]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-[#DCF4D7] text-[#1F7A4C] px-2.5 py-0.5 rounded-full border border-[#C3EBC0]">
                Presupuesto Oficial
              </span>
              <span className="text-base sm:text-lg font-black text-neutral-800">
                N° #{String(quote.quote_number).padStart(4, "0")}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span>
                Emisión: <strong>{new Date(quote.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Ficha de Datos del Cliente y Condiciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAF8] p-4 rounded-2xl border border-[#EAF0E8]">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
              Preparado para:
            </span>
            <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#3BB578]" />
              <span>{quote.client_name}</span>
            </h3>
            {quote.client_contact && (
              <p className="text-xs text-neutral-600 flex items-center gap-1.5 pt-0.5">
                <Phone className="w-3 h-3 text-neutral-400" />
                <span>{quote.client_contact}</span>
              </p>
            )}
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
              Condiciones de la propuesta:
            </span>
            <div className="text-xs text-neutral-700 font-semibold flex items-center sm:justify-end gap-1">
              <Clock className="w-3.5 h-3.5 text-[#3BB578]" />
              <span>Vigencia: 15 días corridos</span>
            </div>
            {quote.delivery_date && (
              <p className="text-[11px] text-neutral-500 flex items-center sm:justify-end gap-1">
                <span>Entrega estimada:</span>
                <strong className="text-neutral-700">
                  {new Date(quote.delivery_date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                </strong>
              </p>
            )}
          </div>
        </div>

        {/* Tabla de Productos Cotizados */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F7A4C] block">
            Detalle de Productos & Servicios
          </span>

          <div className="border border-[#EAF0E8] rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#DCF4D7] text-[#1F7A4C] font-bold text-[11px] border-b border-[#C3EBC0]">
                <tr>
                  <th className="py-2.5 px-3">Producto / Ítem</th>
                  <th className="py-2.5 px-2 text-center">Canal</th>
                  <th className="py-2.5 px-2 text-center">Cant.</th>
                  <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {quote.quote_items && quote.quote_items.length > 0 ? (
                  quote.quote_items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-neutral-50/50 transition">
                      <td className="py-3 px-3 font-bold text-neutral-800">
                        {item.product_name}
                      </td>
                      <td className="py-3 px-2 text-center text-neutral-500 text-[11px]">
                        <span className="bg-neutral-100 px-2 py-0.5 rounded-full">
                          {item.channel_name || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-black text-neutral-700">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-3 text-right text-neutral-600">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-[#1F7A4C]">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-neutral-400 italic">
                      Sin ítems cargados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de Totales y Descuentos */}
        <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-2">
          {/* Sello de Seguridad / Garantía de Precios */}
          <div className="w-full sm:w-auto p-3 bg-[#F0FAF4] border border-[#DCF4D7] rounded-2xl flex items-center gap-2 text-xs text-[#1F7A4C]">
            <ShieldCheck className="w-4 h-4 text-[#3BB578] flex-shrink-0" />
            <div>
              <span className="font-bold block">Precios Congelados</span>
              <span className="text-[10px] text-neutral-500">
                Los valores quedan asegurados durante el período de vigencia.
              </span>
            </div>
          </div>

          {/* Liquidación de Totales */}
          <div className="w-full sm:w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-600 px-1">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCurrency(quote.subtotal)}</span>
            </div>

            {quote.discount_percent > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold px-1">
                <span>Descuento ({quote.discount_percent}%):</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {shippingCost > 0 && (
              <div className="flex justify-between text-[#1F7A4C] font-semibold px-1">
                <span>Costo de Envío:</span>
                <span>+{formatCurrency(shippingCost)}</span>
              </div>
            )}

            {/* Total Final Destacado HABA */}
            <div className="bg-[#DCF4D7] border border-[#C3EBC0] p-3 rounded-2xl flex items-center justify-between text-[#1F7A4C] shadow-xs mt-1">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block">
                  Total Final
                </span>
                <span className="text-[9px] text-[#1F7A4C]/80 block">
                  Presupuesto congelado
                </span>
              </div>
              <span className="text-xl font-black">
                {formatCurrency(quote.total)}
              </span>
            </div>
            {shippingCost > 0 && (
              <p className="text-[9.5px] text-neutral-400 text-right italic px-1 pt-0.5">
                * Tarifa de envío cotizada sujeta a variación del correo.
              </p>
            )}
          </div>
        </div>

        {/* Notas y Condiciones Particulares */}
        {cleanNotes && (
          <div className="bg-[#FFFDF5] border border-[#FEF3C7] p-3.5 rounded-2xl space-y-1 text-xs text-amber-900">
            <span className="font-bold flex items-center gap-1.5 text-amber-800">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Condiciones de entrega y formas de pago:</span>
            </span>
            <p className="whitespace-pre-line text-neutral-700 leading-relaxed text-[11px]">
              {cleanNotes}
            </p>
          </div>
        )}

        {/* Pie de Página Oficial con Vigencia y Contacto */}
        <div className="border-t border-neutral-200/80 pt-4 space-y-2 text-[10px] text-neutral-500">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
            <p>
              <strong className="text-neutral-700">Cláusula de Vigencia:</strong> Este presupuesto tiene una validez de{" "}
              <strong>15 días corridos</strong> desde su emisión. Transcurrido dicho plazo, los precios quedan sujetos a reajuste según costo de insumos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-neutral-400">
            <span>
              Emitido para <strong>{quote.client_name}</strong> {quote.client_contact ? `(${quote.client_contact})` : ""}
            </span>
            <span className="flex items-center gap-1 font-semibold text-[#1F7A4C]">
              <span>Generado con HABA</span>
              <span>•</span>
              <span>Software de Costeo Artesanal</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
