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

export default function PresupuestosPage() {
  const supabase = createClient();

  const [quotes, setQuotes] = useState<Quote[]>([]);
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

  useEffect(() => {
    loadQuotes();
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

  // Generar mensaje de WhatsApp con el detalle del presupuesto
  const shareViaWhatsApp = (quote: Quote) => {
    const itemsText = (quote.quote_items || [])
      .map(
        (item) =>
          `• ${item.quantity}x ${item.product_name} (${formatCurrency(item.unit_price)}) = ${formatCurrency(
            item.subtotal
          )}`
      )
      .join("%0A");

    const discountText =
      quote.discount_percent > 0
        ? `%0ADescuento (${quote.discount_percent}%): -${formatCurrency(
            (quote.subtotal * quote.discount_percent) / 100
          )}`
        : "";

    const notesText = quote.notes ? `%0A%0A*Condiciones / Notas:*%0A${encodeURIComponent(quote.notes)}` : "";

    const text = `*Presupuesto ${quote.quote_number}* 🌸%0A%0A*Cliente:* ${encodeURIComponent(
      quote.client_name
    )}%0A%0A*Detalle:*%0A${itemsText}%0A%0A*Subtotal:* ${formatCurrency(
      quote.subtotal
    )}${discountText}%0A*TOTAL FINAL:* ${formatCurrency(quote.total)}${notesText}%0A%0A¡Muchas gracias por tu consulta!`;

    const phoneClean = quote.client_contact?.replace(/[^0-9]/g, "") || "";
    const waUrl = phoneClean
      ? `https://wa.me/${phoneClean}?text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(waUrl, "_blank");
  };

  // Descarga / Impresión nativa como PDF
  const printQuote = (quote: Quote) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsRows = (quote.quote_items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formatCurrency(item.subtotal)}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Presupuesto ${quote.quote_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #333; max-width: 600px; margin: auto; }
            .header { border-bottom: 2px solid #3b7c42; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            h1 { margin: 0; font-size: 24px; color: #244228; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #e5f2e6; color: #244228; padding: 8px; text-align: left; font-size: 12px; }
            .totals { margin-top: 20px; text-align: right; }
            .total-line { font-size: 18px; font-weight: bold; color: #244228; margin-top: 5px; }
            .footer { margin-top: 30px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>PRESUPUESTO</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #666;">N°: <strong>${quote.quote_number}</strong></p>
            </div>
            <div style="text-align: right; font-size: 12px;">
              <p style="margin: 0;">Fecha: ${new Date(quote.created_at).toLocaleDateString("es-AR")}</p>
              ${quote.delivery_date ? `<p style="margin: 3px 0 0;">Entrega: ${new Date(quote.delivery_date).toLocaleDateString("es-AR")}</p>` : ""}
            </div>
          </div>

          <div style="margin-bottom: 15px; font-size: 13px;">
            <strong>Cliente:</strong> ${quote.client_name} ${quote.client_contact ? `(${quote.client_contact})` : ""}
          </div>

          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align: center;">Cant</th>
                <th style="text-align: right;">Unitario</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals">
            <p style="margin: 4px 0; font-size: 13px;">Subtotal: ${formatCurrency(quote.subtotal)}</p>
            ${quote.discount_percent > 0 ? `<p style="margin: 4px 0; font-size: 13px; color: #b91c1c;">Descuento (${quote.discount_percent}%): -${formatCurrency((quote.subtotal * quote.discount_percent) / 100)}</p>` : ""}
            <p class="total-line">TOTAL: ${formatCurrency(quote.total)}</p>
          </div>

          ${quote.notes ? `<div style="margin-top: 25px; padding: 12px; background: #f9f9f9; border-radius: 8px; font-size: 12px;"><strong>Condiciones:</strong><br/>${quote.notes.replace(/\n/g, "<br/>")}</div>` : ""}

          <div class="footer">
            Generado con HABA — Presupuesto con valores congelados.
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
    return quotes.filter(
      (q) =>
        q.client_name.toLowerCase().includes(search.toLowerCase()) ||
        String(q.quote_number).toLowerCase().includes(search.toLowerCase())
    );
  }, [quotes, search]);

  return (
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <span>Presupuestos</span>
            <span className="text-xs bg-[#e5f2e6] text-[#306236] font-semibold px-2 py-0.5 rounded-full">
              {quotes.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-500">Cotizaciones profesionales y PDF para clientes</p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="p-2.5 bg-[#3b7c42] hover:bg-[#326b38] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
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
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none shadow-sm transition"
        />
      </div>

      {/* Listado de Presupuestos o Estado Vacío */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Cargando tus presupuestos...
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
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
                className="bg-white rounded-3xl p-4 border border-[#eef2eb] shadow-sm flex flex-col space-y-3 transition hover:border-[#cce5ce]"
              >
                {/* Cabecera del presupuesto */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#306236] bg-[#e5f2e6] px-2 py-0.5 rounded-full">
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
                    <span className="text-base font-black text-[#244228] block">
                      {formatCurrency(quote.total)}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      {quote.quote_items?.length || 0} ítems
                    </span>
                  </div>
                </div>

                {/* Acciones Rápidas: WhatsApp, PDF, Desplegar */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
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
                          <span className="font-extrabold text-[#244228]">
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
