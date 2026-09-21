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
  Mail,
  MapPin,
  AtSign,
  AlertTriangle,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";
import {
  Quote,
  QuoteItem,
  UserProfile,
  getQuoteValidity,
  buildQuoteWhatsAppMessage,
  parseQuoteNotes,
} from "@/lib/quotes";


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

        // 2. Cargar perfil del emisor para branding y datos de contacto
        if (quoteData.user_id) {
          let pData: any = null;
          try {
            const { data: fullProfileData } = await supabase
              .from("profiles")
              .select("business_name, full_name, email, phone, business_phone, business_email, instagram, address")
              .eq("id", quoteData.user_id)
              .maybeSingle();
            pData = fullProfileData;
          } catch {
            const { data: baseProfileData } = await supabase
              .from("profiles")
              .select("business_name, full_name, email")
              .eq("id", quoteData.user_id)
              .maybeSingle();
            pData = baseProfileData;
          }

          // Si el usuario logueado es el mismo emisor, enriquecer con user_metadata
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.id === quoteData.user_id) {
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
          }

          if (pData) {
            setProfile(pData);
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
  const { shippingCost, cleanNotes } = React.useMemo(() => {
    return parseQuoteNotes(quote?.notes);
  }, [quote?.notes]);

  const validity = React.useMemo(() => {
    if (!quote) return null;
    return getQuoteValidity(quote);
  }, [quote]);

  // Compartir por WhatsApp / Web Share API
  const handleShareWhatsApp = async () => {
    if (!quote) return;

    const fullMessage = buildQuoteWhatsAppMessage(quote, profile, validity || undefined);

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
      {/* Estilos específicos para impresión impecable en hoja A4 cubriendo el total de la hoja y ajustando en una sola carátula */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            background-color: #ffffff !important;
            color: #1a1a1a !important;
            margin: 0 !important;
            padding: 10mm 12mm !important;
            width: 100% !important;
            height: auto !important;
          }
          main,
          div[class*="pb-"],
          div[class*="space-y-"] {
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }
          header,
          nav,
          aside,
          .print-hidden,
          [role="navigation"] {
            display: none !important;
          }
          /* La hoja del presupuesto cubre el 100% del ancho A4 disponible */
          .quote-sheet {
            box-shadow: none !important;
            border: 1.5px solid #d1d5db !important;
            border-radius: 12px !important;
            padding: 14px 18px !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          /* Ajuste vertical compacto para garantizar una sola hoja si corresponde */
          .quote-sheet > * + * {
            margin-top: 8px !important;
          }
          .quote-header {
            padding-bottom: 8px !important;
          }
          .quote-client {
            padding: 8px 12px !important;
            gap: 8px !important;
          }
          .quote-table th {
            padding: 5px 8px !important;
            font-size: 10px !important;
          }
          .quote-table td {
            padding: 4px 8px !important;
            font-size: 10.5px !important;
          }
          .quote-totals {
            padding-top: 4px !important;
            gap: 8px !important;
          }
          .quote-total-banner {
            padding: 6px 12px !important;
          }
          .quote-notes {
            padding: 6px 10px !important;
            margin-top: 4px !important;
          }
          .quote-footer {
            padding-top: 6px !important;
            margin-top: 6px !important;
          }
          /* Evitar cortes antiestéticos en elementos de la hoja */
          .quote-header,
          .quote-client,
          .quote-table-container,
          .quote-table tr,
          .quote-totals,
          .quote-notes,
          .quote-footer {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
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
              {validity?.isExpired ? (
                <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-600" />
                  <span>Vencido ({validity.formattedValidUntil})</span>
                </span>
              ) : (
                <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#1F7A4C]" />
                  <span>
                    Válido hasta {validity?.formattedValidUntil} ({validity?.daysRemaining}{" "}
                    {validity?.daysRemaining === 1 ? "día" : "días"})
                  </span>
                </span>
              )}
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

      {/* Banner de advertencia si el presupuesto ya venció */}
      {validity?.isExpired && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-900 shadow-2xs gap-3 print-hidden animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div>
              <span className="font-bold block">
                Presupuesto vencido el {validity.formattedValidUntil}
              </span>
              <span className="text-[11px] text-rose-700 block">
                El período de precios congelados expiró. Requiere revisión de costos de insumos antes de confirmar con el cliente.
              </span>
            </div>
          </div>
          <Link
            href={`/presupuestos/nuevo?edit=${quote.id}`}
            className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 shadow-xs active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Actualizar Costos</span>
          </Link>
        </div>
      )}

      {/* Hoja del Presupuesto con Branding HABA (Estructura de Documento A4) */}
      <div className="quote-sheet bg-white rounded-3xl p-6 sm:p-10 border border-[#EAF0E8] shadow-sm max-w-3xl mx-auto w-full space-y-6">
        {/* Cabecera Institucional y Branding (Puntos D y G) */}
        <div className="quote-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#EAF0E8] pb-6">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-neutral-500 pt-0.5">
                {(profile?.business_phone || profile?.phone) && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#3BB578]" />
                    <span>{profile.business_phone || profile.phone}</span>
                  </span>
                )}
                {(profile?.business_email || profile?.email) && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#3BB578]" />
                    <span>{profile.business_email || profile.email}</span>
                  </span>
                )}
                {profile?.instagram && (
                  <span className="flex items-center gap-1">
                    <AtSign className="w-3 h-3 text-[#3BB578]" />
                    <span>{profile.instagram}</span>
                  </span>
                )}
                {profile?.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#3BB578]" />
                    <span>{profile.address}</span>
                  </span>
                )}
              </div>
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
        <div className="quote-client grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAF8] p-4 rounded-2xl border border-[#EAF0E8]">
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
              <span>Vigencia: {validity?.validityDays} días corridos</span>
            </div>
            <p className="text-[11px] text-neutral-500 flex items-center sm:justify-end gap-1">
              <span>Vence:</span>
              <strong className={validity?.isExpired ? "text-rose-600 font-bold" : "text-neutral-700"}>
                {validity?.formattedValidUntil}
              </strong>
              {validity?.isExpired ? (
                <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded-md">Vencido</span>
              ) : (
                <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded-md">Vigente</span>
              )}
            </p>
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
        <div className="quote-table-container space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F7A4C] block">
            Detalle de Productos & Servicios
          </span>

          <div className="border border-[#EAF0E8] rounded-2xl overflow-hidden shadow-2xs">
            <table className="quote-table w-full text-xs text-left border-collapse">
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
        <div className="quote-totals flex flex-col sm:flex-row items-end justify-between gap-4 pt-2">
          {/* Sello de Seguridad / Garantía de Precios */}
          <div className="w-full sm:w-auto p-3 bg-[#F0FAF4] border border-[#DCF4D7] rounded-2xl text-xs text-[#1F7A4C]">
            <div>
              <span className="font-bold block">Precios Congelados</span>
              <span className="text-[10px] text-neutral-500">
                Los valores quedan asegurados hasta el {validity?.formattedValidUntil} ({validity?.validityDays} días corridos desde su emisión).
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
            <div className="quote-total-banner bg-[#DCF4D7] border border-[#C3EBC0] p-3 rounded-2xl flex items-center justify-between text-[#1F7A4C] shadow-xs mt-1">
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
          <div className="quote-notes bg-[#FFFDF5] border border-[#FEF3C7] p-3.5 rounded-2xl space-y-1 text-xs text-amber-900">
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
        <div className="quote-footer border-t border-neutral-200/80 pt-4 space-y-2 text-[10px] text-neutral-500">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
            <p>
              <strong className="text-neutral-700">Cláusula de Vigencia:</strong> {validity?.formattedClause}
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
