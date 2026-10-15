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
  Clock,
  AlertTriangle,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { matchesSearch } from "@/lib/search";
import { useFormatPrefs } from "@/hooks/useFormatPrefs";
import {
  Quote,
  QuoteItem,
  UserProfile,
  getQuoteValidity,
  buildQuoteWhatsAppMessage,
  parseQuoteNotes,
  generateQuotePrintHtml,
} from "@/lib/quotes";


export default function PresupuestosPage() {
  const supabase = createClient();
  const { formatMoney } = useFormatPrefs();

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
            .select("business_name, full_name, email, phone, business_phone, business_email, instagram, address, currency, number_locale, decimals")
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
        const localColor = typeof window !== "undefined" ? localStorage.getItem("haba_quote_primary_color") : null;
        const localRubro = typeof window !== "undefined" ? localStorage.getItem("haba_business_rubro") : null;
        pData = {
          ...(pData || {}),
          business_name: pData?.business_name || meta.business_name || null,
          full_name: pData?.full_name || meta.full_name || null,
          phone: pData?.business_phone || pData?.phone || meta.business_phone || meta.phone || null,
          business_phone: pData?.business_phone || meta.business_phone || meta.phone || null,
          business_email: pData?.business_email || meta.business_email || null,
          instagram: pData?.instagram || meta.instagram || null,
          address: pData?.address || meta.address || null,
          avatar_url: pData?.avatar_url || meta.avatar_url || null,
          logo_url: pData?.avatar_url || meta.avatar_url || null,
          business_rubro: pData?.business_rubro || meta.business_rubro || localRubro || null,
          quote_primary_color: pData?.quote_primary_color || meta.quote_primary_color || localColor || null,
        };

        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const apiRes = await res.json();
            if (apiRes?.profile) {
              pData = {
                ...pData,
                ...apiRes.profile,
                avatar_url: apiRes.profile.avatar_url || pData?.avatar_url,
                logo_url: apiRes.profile.avatar_url || pData?.logo_url,
              };
            }
          }
        } catch {
          // ignore
        }

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
    const fullMessage = buildQuoteWhatsAppMessage(quote, userProfile);

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

  // Descarga / Impresión nativa como PDF en formato A4 con diseño profesional idéntico a Vista Previa
  const printQuote = (quote: Quote) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = generateQuotePrintHtml(quote, userProfile);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => {
            const isExpanded = expandedQuoteId === quote.id;
            const validity = getQuoteValidity(quote);
            const { cleanNotes } = parseQuoteNotes(quote.notes);

            return (
              <div
                key={quote.id}
                className={`bg-white rounded-3xl p-4 border shadow-sm flex flex-col space-y-3 transition ${
                  validity.isExpired
                    ? "border-rose-200 hover:border-rose-300"
                    : "border-[#EAF0E8] hover:border-[#C3EBC0]"
                }`}
              >
                {/* Cabecera del presupuesto */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full">
                        #{quote.quote_number}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Emisión: {validity.formattedIssuedAt}
                      </span>
                      {validity.isExpired ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                          <Clock className="w-3 h-3 text-rose-600 flex-shrink-0" />
                          <span>Vencido ({validity.formattedValidUntil})</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                          <Clock className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span>
                            Válido hasta {validity.formattedValidUntil} ({validity.daysRemaining}{" "}
                            {validity.daysRemaining === 1 ? "día" : "días"})
                          </span>
                        </span>
                      )}
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
                      {formatMoney(quote.total)}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      {quote.quote_items?.length || 0} ítems
                    </span>
                  </div>
                </div>

                {/* Alerta de presupuesto vencido si superó la fecha límite */}
                {validity.isExpired && (
                  <div className="p-2.5 bg-rose-50/90 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-rose-900 shadow-2xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span className="text-[11px] font-semibold leading-tight">
                        Presupuesto vencido — requiere revisión de costos antes de confirmar con el cliente.
                      </span>
                    </div>
                    <Link
                      href={`/presupuestos/nuevo?edit=${quote.id}`}
                      className="py-1 px-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition shadow-xs flex-shrink-0 whitespace-nowrap"
                      title="Editar y actualizar presupuesto"
                    >
                      <Edit2 className="w-3 h-3 flex-shrink-0" />
                      <span>Actualizar</span>
                    </Link>
                  </div>
                )}

                {/* Acciones Rápidas: WhatsApp, PDF, Desplegar */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/presupuestos/${quote.id}`}
                      className="py-1.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs active:scale-95 flex-shrink-0 whitespace-nowrap"
                      title="Ver vista previa oficial del presupuesto"
                    >
                      <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Vista Previa</span>
                    </Link>

                    <button
                      onClick={() => shareViaWhatsApp(quote)}
                      className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                      title="Enviar por WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => printQuote(quote)}
                      className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                      title="Imprimir o Guardar PDF"
                    >
                      <Printer className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>PDF</span>
                    </button>

                    <Link
                      href={`/presupuestos/nuevo?edit=${quote.id}`}
                      className="py-1.5 px-3 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                      title="Editar este presupuesto"
                    >
                      <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
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

                {/* Detalle Desplegado de Ítems Congelados y Vigencia */}
                {isExpanded && (
                  <div className="pt-2 border-t border-neutral-100 space-y-2.5 animate-in fade-in-50 duration-200">
                    {/* Cláusula y Vigencia en Vista Desplegada */}
                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70 text-[11px] text-neutral-600 space-y-1">
                      <div className="flex items-center justify-between font-semibold text-neutral-700">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#3BB578]" />
                          <span>Vigencia: {validity.validityDays} días corridos</span>
                        </span>
                        <span>Límite: {validity.formattedValidUntil}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 italic">
                        {validity.formattedClause}
                      </p>
                    </div>

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
                              Canal: {item.channel_name} | Unit: {formatMoney(item.unit_price)}
                            </span>
                          </div>
                          <span className="font-extrabold text-[#1F7A4C]">
                            {formatMoney(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {cleanNotes && (
                      <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-[11px] text-amber-800">
                        <strong className="block">Notas:</strong>
                        {cleanNotes}
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
