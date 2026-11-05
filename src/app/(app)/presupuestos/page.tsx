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
  ChevronRight,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import { ViewModeToggle, ExportMenu, useViewMode } from "@/components/ListToolbar";
import { downloadCsv, openPdfReport, ExportColumn } from "@/lib/exporters";
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
  QUOTE_STATUSES,
  QUOTE_STATUS_META,
  QuoteStatus,
  QuoteDisplayStatus,
  getQuoteStatus,
  getQuoteDisplayStatus,
} from "@/lib/quotes";

type StatusFilter = "todos" | QuoteDisplayStatus;
type PeriodFilter = "todo" | "mes" | "mes_anterior" | "trimestre" | "anio";

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: "todo", label: "Todo el tiempo" },
  { key: "mes", label: "Este mes" },
  { key: "mes_anterior", label: "Mes anterior" },
  { key: "trimestre", label: "Últimos 3 meses" },
  { key: "anio", label: "Este año" },
];

const STATUS_FILTERS: StatusFilter[] = ["todos", "borrador", "pendiente", "aceptado", "rechazado", "vencido"];

/** true si la fecha de emisión cae dentro del período elegido. */
function isInPeriod(createdAt: string | undefined, period: PeriodFilter, now = new Date()): boolean {
  if (period === "todo") return true;
  if (!createdAt) return false;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return false;
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "mes":
      return d.getFullYear() === y && d.getMonth() === m;
    case "mes_anterior": {
      const prev = new Date(y, m - 1, 1);
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    }
    case "trimestre":
      return d >= new Date(y, m - 2, 1);
    case "anio":
      return d.getFullYear() === y;
    default:
      return true;
  }
}


export default function PresupuestosPage() {
  const supabase = createClient();
  const { formatMoney, prefs: userFormatPrefs } = useFormatPrefs();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [period, setPeriod] = useState<PeriodFilter>("todo");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewMode("presupuestos");

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
          currency: meta.currency || pData?.currency || userFormatPrefs.currency || "ARS",
          number_locale: meta.number_locale || meta.numberLocale || pData?.number_locale || pData?.numberLocale || userFormatPrefs.numberLocale || "es-AR",
          numberLocale: meta.number_locale || meta.numberLocale || pData?.number_locale || pData?.numberLocale || userFormatPrefs.numberLocale || "es-AR",
          decimals: typeof meta.decimals === "number" ? meta.decimals : (typeof pData?.decimals === "number" ? pData.decimals : userFormatPrefs.decimals),
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
    const effectiveProfile: UserProfile = {
      ...(userProfile || {}),
      currency: userProfile?.currency || userFormatPrefs.currency,
      number_locale: userProfile?.number_locale || userProfile?.numberLocale || userFormatPrefs.numberLocale,
      numberLocale: userProfile?.number_locale || userProfile?.numberLocale || userFormatPrefs.numberLocale,
      decimals: typeof userProfile?.decimals === "number" ? userProfile.decimals : userFormatPrefs.decimals,
    };
    const fullMessage = buildQuoteWhatsAppMessage(quote, effectiveProfile);

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

    const effectiveProfile: UserProfile = {
      ...(userProfile || {}),
      currency: userProfile?.currency || userFormatPrefs.currency,
      number_locale: userProfile?.number_locale || userProfile?.numberLocale || userFormatPrefs.numberLocale,
      numberLocale: userProfile?.number_locale || userProfile?.numberLocale || userFormatPrefs.numberLocale,
      decimals: typeof userProfile?.decimals === "number" ? userProfile.decimals : userFormatPrefs.decimals,
    };

    const html = generateQuotePrintHtml(quote, effectiveProfile);

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Cambiar el estado de un presupuesto (borrador, pendiente, aceptado, rechazado)
  const handleStatusChange = async (quote: Quote, nextStatus: QuoteStatus) => {
    if (getQuoteStatus(quote) === nextStatus) return;
    const previous = quote.status;
    const nowIso = new Date().toISOString();
    setUpdatingStatusId(quote.id);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quote.id ? { ...q, status: nextStatus, status_updated_at: nowIso } : q))
    );
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: nextStatus, status_updated_at: nowIso })
        .eq("id", quote.id);
      if (error) throw error;
    } catch (err: any) {
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? { ...q, status: previous } : q)));
      alert("No se pudo cambiar el estado del presupuesto: " + (err?.message || "error desconocido"));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Búsqueda y período (base para los totales y los contadores por estado)
  const periodQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (!isInPeriod(q.created_at, period)) return false;
      if (search.trim() && !matchesSearch([q.client_name, q.quote_number, q.notes], search)) return false;
      return true;
    });
  }, [quotes, search, period]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      todos: periodQuotes.length,
      borrador: 0,
      pendiente: 0,
      aceptado: 0,
      rechazado: 0,
      vencido: 0,
    };
    for (const q of periodQuotes) counts[getQuoteDisplayStatus(q)] += 1;
    return counts;
  }, [periodQuotes]);

  const totals = useMemo(() => {
    let accepted = 0;
    let pending = 0;
    for (const q of periodQuotes) {
      const status = getQuoteDisplayStatus(q);
      if (status === "aceptado") accepted += Number(q.total) || 0;
      if (status === "pendiente") pending += Number(q.total) || 0;
    }
    const answered = statusCounts.aceptado + statusCounts.rechazado;
    const acceptanceRate = answered > 0 ? Math.round((statusCounts.aceptado / answered) * 100) : null;
    return { accepted, pending, acceptanceRate };
  }, [periodQuotes, statusCounts]);

  const filteredQuotes = useMemo(() => {
    if (statusFilter === "todos") return periodQuotes;
    return periodQuotes.filter((q) => getQuoteDisplayStatus(q) === statusFilter);
  }, [periodQuotes, statusFilter]);

  const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label || "";
  const hasFilters = Boolean(search.trim()) || statusFilter !== "todos" || period !== "todo";

  // Exportación del listado filtrado
  const exportColumns: ExportColumn<Quote>[] = [
    { header: "Número", value: (q) => String(q.quote_number) },
    {
      header: "Emisión",
      value: (q) => (q.created_at ? new Date(q.created_at).toLocaleDateString("es-AR") : ""),
    },
    { header: "Cliente", value: (q) => q.client_name },
    { header: "Contacto", value: (q) => q.client_contact || "" },
    { header: "Estado", value: (q) => QUOTE_STATUS_META[getQuoteDisplayStatus(q)].label },
    { header: "Válido hasta", value: (q) => getQuoteValidity(q).formattedValidUntil },
    { header: "Ítems", value: (q) => q.quote_items?.length || 0, align: "center" },
    {
      header: "Descuento %",
      value: (q) => Number(q.discount_percent) || 0,
      display: (q) => (Number(q.discount_percent) ? `${q.discount_percent}%` : "-"),
      align: "right",
    },
    {
      header: "Total",
      value: (q) => Number(q.total) || 0,
      display: (q) => formatMoney(q.total),
      align: "right",
    },
  ];

  const exportSubtitle = [
    periodLabel,
    statusFilter !== "todos" ? QUOTE_STATUS_META[statusFilter].label : "Todos los estados",
    search.trim() ? `Búsqueda: "${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleExportCsv = () => downloadCsv("presupuestos", exportColumns, filteredQuotes);
  const handleExportPdf = () => {
    const ok = openPdfReport({
      title: "Presupuestos",
      subtitle: exportSubtitle,
      businessName: userProfile?.business_name,
      columns: exportColumns,
      rows: filteredQuotes,
      summary: [
        { label: "Aceptados", value: formatMoney(totals.accepted) },
        { label: "Pendientes", value: formatMoney(totals.pending) },
        { label: "Presupuestos", value: String(filteredQuotes.length) },
      ],
    });
    if (!ok) alert("Tu navegador bloqueó la ventana emergente. Permití las ventanas emergentes para HABA.");
  };

  // Selector de estado en forma de píldora (select nativo para que funcione bien en el celular)
  const renderStatusPicker = (quote: Quote) => {
    const display = getQuoteDisplayStatus(quote);
    const meta = QUOTE_STATUS_META[display];
    return (
      <label
        onClick={(e) => e.stopPropagation()}
        className={`relative inline-flex items-center gap-1.5 text-[10px] font-bold pl-2 pr-6 py-0.5 rounded-full border cursor-pointer flex-shrink-0 whitespace-nowrap ${meta.className} ${
          updatingStatusId === quote.id ? "opacity-60" : ""
        }`}
        title="Cambiar estado del presupuesto"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClassName}`} aria-hidden="true" />
        <span>{meta.label}</span>
        <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none" aria-hidden="true" />
        <select
          value={getQuoteStatus(quote)}
          disabled={updatingStatusId === quote.id}
          onChange={(e) => handleStatusChange(quote, e.target.value as QuoteStatus)}
          aria-label={`Estado del presupuesto #${quote.quote_number}`}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
        >
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const renderQuoteCard = (quote: Quote) => {
    const isExpanded = expandedQuoteId === quote.id;
    const validity = getQuoteValidity(quote);
    const display = getQuoteDisplayStatus(quote);
    const isExpired = display === "vencido";
    const { cleanNotes } = parseQuoteNotes(quote.notes);

    return (
      <div
        key={quote.id}
        className={`bg-white rounded-3xl p-4 border shadow-sm flex flex-col space-y-3 transition ${
          isExpired
            ? "border-rose-200 hover:border-rose-300"
            : display === "aceptado"
            ? "border-emerald-200 hover:border-emerald-300"
            : "border-[#EAF0E8] hover:border-[#C3EBC0]"
        }`}
      >
        {/* Cabecera del presupuesto */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full">
                #{quote.quote_number}
              </span>
              {renderStatusPicker(quote)}
              <span className="text-[10px] text-neutral-400">Emisión: {validity.formattedIssuedAt}</span>
            </div>
            <h3 className="text-sm font-bold text-neutral-800 mt-1 break-words">{quote.client_name}</h3>
            {quote.client_contact && (
              <p className="text-[11px] text-neutral-400 mt-0.5">{quote.client_contact}</p>
            )}
            {display === "pendiente" && (
              <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span>
                  Válido hasta {validity.formattedValidUntil} ({validity.daysRemaining}{" "}
                  {validity.daysRemaining === 1 ? "día" : "días"})
                </span>
              </p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <span className="text-base font-black text-[#1F7A4C] block">{formatMoney(quote.total)}</span>
            <span className="text-[10px] text-neutral-400 block">{quote.quote_items?.length || 0} ítems</span>
          </div>
        </div>

        {/* Alerta de presupuesto vencido (solo pendientes que pasaron su validez) */}
        {isExpired && (
          <div className="p-2.5 bg-rose-50/90 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-rose-900 shadow-2xs gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="text-[11px] font-semibold leading-tight">
                Venció el {validity.formattedValidUntil}. Revisá los costos antes de confirmar con el cliente.
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
              title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Detalle Desplegado de Ítems Congelados y Vigencia */}
        {isExpanded && (
          <div className="pt-2 border-t border-neutral-100 space-y-2.5 animate-in fade-in-50 duration-200">
            <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70 text-[11px] text-neutral-600 space-y-1">
              <div className="flex items-center justify-between font-semibold text-neutral-700">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#3BB578]" />
                  <span>Vigencia: {validity.validityDays} días corridos</span>
                </span>
                <span>Límite: {validity.formattedValidUntil}</span>
              </div>
              <p className="text-[10px] text-neutral-400 italic">{validity.formattedClause}</p>
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
                  <span className="font-extrabold text-[#1F7A4C]">{formatMoney(item.subtotal)}</span>
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
  };

  // Fila compacta para la vista de lista: al tocarla se despliega la tarjeta completa
  const renderQuoteRow = (quote: Quote) => {
    const validity = getQuoteValidity(quote);
    return (
      <div
        key={quote.id}
        role="button"
        tabIndex={0}
        onClick={() => setExpandedQuoteId(quote.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpandedQuoteId(quote.id);
          }
        }}
        className="flex items-center gap-3 px-3.5 py-2.5 bg-white hover:bg-[#F6F7F2] transition cursor-pointer"
      >
        <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full flex-shrink-0">
          #{quote.quote_number}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold text-neutral-800 block truncate">{quote.client_name}</span>
          <span className="text-[10px] text-neutral-400 block truncate">
            {validity.formattedIssuedAt} · {quote.quote_items?.length || 0} ítems
          </span>
        </div>
        <div className="hidden sm:block">{renderStatusPicker(quote)}</div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs font-black text-[#1F7A4C] block">{formatMoney(quote.total)}</span>
          <span className="sm:hidden block mt-0.5">{renderStatusPicker(quote)}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
      </div>
    );
  };

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

      {/* Totales del período */}
      {quotes.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#DCF4D7]/70 rounded-2xl p-3 border border-[#C3EBC0]">
            <span className="text-[10px] font-bold text-[#1F7A4C] uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aceptados
            </span>
            <span className="text-lg font-black text-[#1F7A4C] block leading-tight mt-0.5 break-all">
              {formatMoney(totals.accepted)}
            </span>
            <span className="text-[10px] text-[#1F7A4C]/80 block">
              {statusCounts.aceptado} {statusCounts.aceptado === 1 ? "presupuesto" : "presupuestos"}
              {totals.acceptanceRate !== null && ` · ${totals.acceptanceRate}% de aceptación`}
            </span>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-[#EAF0E8]">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Hourglass className="w-3.5 h-3.5" />
              Pendientes
            </span>
            <span className="text-lg font-black text-neutral-800 block leading-tight mt-0.5 break-all">
              {formatMoney(totals.pending)}
            </span>
            <span className="text-[10px] text-neutral-400 block">
              {statusCounts.pendiente} {statusCounts.pendiente === 1 ? "presupuesto" : "presupuestos"} esperando
              respuesta
            </span>
          </div>
        </div>
      )}

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

      {/* Filtros por estado */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {STATUS_FILTERS.map((key) => {
          const active = statusFilter === key;
          const label = key === "todos" ? "Todos" : QUOTE_STATUS_META[key].label;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              aria-pressed={active}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
                active
                  ? "bg-[#1F7A4C] text-white border-[#1F7A4C] shadow-sm"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-[#C3EBC0]"
              }`}
            >
              {key !== "todos" && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : QUOTE_STATUS_META[key].dotClassName}`}
                  aria-hidden="true"
                />
              )}
              <span>{label}</span>
              <span className={active ? "text-white/80" : "text-neutral-400"}>{statusCounts[key]}</span>
            </button>
          );
        })}
      </div>

      {/* Período, exportación y vista */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Calendar className="w-3.5 h-3.5 text-[#1F7A4C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            aria-label="Período"
            className="h-9 pl-8 pr-8 bg-white border border-[#C3EBC0] text-[#1F7A4C] rounded-full text-xs font-bold outline-none appearance-none cursor-pointer shadow-sm focus:ring-2 focus:ring-[#DCF4D7]"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#1F7A4C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("todos");
              setPeriod("todo");
            }}
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ExportMenu onCsv={handleExportCsv} onPdf={handleExportPdf} disabled={filteredQuotes.length === 0} />
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Listado de Presupuestos o Estado Vacío */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">Cargando tus presupuestos...</div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">
              {hasFilters ? "No se encontraron presupuestos" : "No hay presupuestos emitidos"}
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              {hasFilters
                ? "Probá con otro estado, período o búsqueda."
                : "Generá presupuestos congelando precios para enviarlos por WhatsApp o descargarlos en PDF."}
            </p>
          </div>
          {!hasFilters && (
            <Link
              href="/presupuestos/nuevo"
              className="mt-2 py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Armar primer presupuesto</span>
            </Link>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="bg-white rounded-3xl border border-[#EAF0E8] shadow-sm overflow-hidden divide-y divide-[#EAF0E8]">
          {filteredQuotes.map((quote) =>
            expandedQuoteId === quote.id ? (
              <div key={quote.id} className="p-2 bg-[#F6F7F2]">
                {renderQuoteCard(quote)}
              </div>
            ) : (
              renderQuoteRow(quote)
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => renderQuoteCard(quote))}
        </div>
      )}
    </div>
  );
}
