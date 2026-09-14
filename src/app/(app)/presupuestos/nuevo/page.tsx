"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Receipt,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Sparkles,
  ShoppingBag,
  Percent,
  Calendar,
  User,
  Phone,
  FileText,
  ChevronRight,
  Share2,
  Download,
  Edit2,
  Search,
  Truck,
  X,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";

interface ProductPrice {
  id: string;
  channel_name: string;
  profit_margin_percent: number;
  selling_price: number;
}

interface Product {
  id: string;
  name: string;
  total_cost: number;
  product_prices: ProductPrice[];
}

interface QuoteItemLine {
  productId: string;
  productName: string;
  channelName: string;
  unitPrice: number;
  quantity: number;
}

function NuevoPresupuestoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const productIdParam = searchParams.get("productId");
  const isEditing = Boolean(editId);

  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | number | null>(null);
  const [preselectedProductName, setPreselectedProductName] = useState<string | null>(null);

  // Productos disponibles en catálogo
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Datos del Cliente
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Costo de Envío (Punto B)
  const [shippingCost, setShippingCost] = useState<number>(0);

  // Líneas del presupuesto
  const [items, setItems] = useState<QuoteItemLine[]>([]);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // Cargar catálogo de productos con sus precios
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoadingProducts(true);
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            total_cost,
            product_prices (
              id,
              channel_name,
              profit_margin_percent,
              selling_price
            )
          `)
          .order("name", { ascending: true });

        if (!error && data) {
          setProducts(data as Product[]);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchCatalog();
  }, [supabase]);

  // Si viene con parámetro ?edit=[id], cargar datos del presupuesto existente
  useEffect(() => {
    if (!editId) return;

    const fetchQuoteToEdit = async () => {
      try {
        setLoading(true);
        const { data: quote, error } = await supabase
          .from("quotes")
          .select(`
            *,
            quote_items (*)
          `)
          .eq("id", editId)
          .single();

        if (error || !quote) {
          setErrorMsg("No se pudo cargar el presupuesto a editar");
          return;
        }

        setQuoteNumber(quote.quote_number);
        setClientName(quote.client_name || "");
        setClientContact(quote.client_contact || "");
        setDeliveryDate(quote.delivery_date ? quote.delivery_date.split("T")[0] : "");
        setDiscountPercent(quote.discount_percent || 0);
        let rawNotes = quote.notes || "";
        const shippingMatch = rawNotes.match(/\[ENVIO:(\d+(\.\d+)?)\]/);
        if (shippingMatch) {
          setShippingCost(Number(shippingMatch[1]) || 0);
          rawNotes = rawNotes.replace(/\[ENVIO:(\d+(\.\d+)?)\]\n?/, "").trim();
        } else if (quote.shipping_cost) {
          setShippingCost(Number(quote.shipping_cost) || 0);
        }
        setNotes(rawNotes);

        if (quote.quote_items && quote.quote_items.length > 0) {
          setItems(
            quote.quote_items.map((qi: any) => ({
              productId: "",
              productName: qi.product_name,
              channelName: qi.channel_name || "General",
              unitPrice: Number(qi.unit_price) || 0,
              quantity: Number(qi.quantity) || 1,
            }))
          );
        }
      } catch (err: any) {
        console.error("Error loading quote for edit:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuoteToEdit();
  }, [editId, supabase]);

  // Restaurar borrador si el usuario salió temporalmente de la app (Punto E)
  useEffect(() => {
    if (editId) return;
    try {
      const saved = sessionStorage.getItem("haba_draft_nuevo_presupuesto");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.clientName) setClientName(draft.clientName);
        if (draft.clientContact) setClientContact(draft.clientContact);
        if (draft.deliveryDate) setDeliveryDate(draft.deliveryDate);
        if (draft.notes) setNotes(draft.notes);
        if (draft.discountPercent !== undefined) setDiscountPercent(draft.discountPercent);
        if (draft.shippingCost !== undefined) setShippingCost(draft.shippingCost);
        if (draft.items && Array.isArray(draft.items) && draft.items.length > 0) {
          setItems(draft.items);
        }
      }
    } catch {
      // ignore
    }
  }, [editId]);

  // Guardar borrador en sessionStorage reactivamente mientras se escribe (Punto E)
  useEffect(() => {
    if (editId) return;
    try {
      if (clientName || clientContact || items.length > 0 || notes) {
        sessionStorage.setItem(
          "haba_draft_nuevo_presupuesto",
          JSON.stringify({
            clientName,
            clientContact,
            deliveryDate,
            notes,
            discountPercent,
            shippingCost,
            items,
          })
        );
      }
    } catch {
      // ignore
    }
  }, [editId, clientName, clientContact, deliveryDate, notes, discountPercent, shippingCost, items]);

  // Si viene con parámetro ?productId=[id], preseleccionar automáticamente el producto
  useEffect(() => {
    if (!productIdParam || isEditing || products.length === 0) return;

    const alreadyAdded = items.some((item) => item.productId === productIdParam);
    if (alreadyAdded) return;

    const matchedProduct = products.find((p) => p.id === productIdParam);
    if (matchedProduct) {
      // Buscar precio minorista o primer precio configurado
      const defaultPrice =
        matchedProduct.product_prices?.find((pr) =>
          pr.channel_name.toLowerCase().includes("minorista")
        ) || matchedProduct.product_prices?.[0];

      setItems((prev) => {
        if (prev.some((it) => it.productId === productIdParam)) return prev;
        return [
          ...prev,
          {
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            channelName: defaultPrice ? defaultPrice.channel_name : "General",
            unitPrice: defaultPrice ? defaultPrice.selling_price : matchedProduct.total_cost || 0,
            quantity: 1,
          },
        ];
      });
      setPreselectedProductName(matchedProduct.name);
    }
  }, [productIdParam, products, isEditing, items]);

  // Agregar producto a la cotización
  const handleAddProduct = (product: Product, price: ProductPrice) => {
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        channelName: price.channel_name,
        unitPrice: price.selling_price,
        quantity: 1,
      },
    ]);
    setIsProductPickerOpen(false);
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index].quantity = qty;
      return updated;
    });
  };

  const handleUpdateItemPrice = (index: number, price: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index].unitPrice = price;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculos reactivos de subtotales y total congelado
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + item.unitPrice * (item.quantity || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (!discountPercent || discountPercent <= 0) return 0;
    return subtotal * (discountPercent / 100);
  }, [subtotal, discountPercent]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount) + (shippingCost || 0);
  }, [subtotal, discountAmount, shippingCost]);

  // Guardar presupuesto congelado en Supabase
  const handleSaveQuote = async () => {
    setErrorMsg(null);
    if (!clientName.trim()) {
      setErrorMsg("El nombre del cliente o contacto es obligatorio");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Agregá al menos un producto al presupuesto");
      return;
    }

    const finalNotes = shippingCost > 0 
      ? `[ENVIO:${shippingCost}]\n${notes.trim()}`.trim()
      : notes.trim() || null;

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sesión no válida");

      if (isEditing && editId) {
        // 1. Actualizar tabla quotes
        const { error: quoteError } = await supabase
          .from("quotes")
          .update({
            client_name: clientName.trim(),
            client_contact: clientContact.trim() || null,
            delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : null,
            discount_percent: discountPercent || 0,
            subtotal: subtotal,
            total: total,
            notes: finalNotes,
          })
          .eq("id", editId);

        if (quoteError) throw new Error(quoteError.message);

        // 2. Reemplazar quote_items
        await supabase.from("quote_items").delete().eq("quote_id", editId);
        const quoteItemsToInsert = items.map((item) => ({
          quote_id: editId,
          product_name: item.productName,
          channel_name: item.channelName,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.unitPrice * item.quantity,
        }));
        await supabase.from("quote_items").insert(quoteItemsToInsert);

        router.push(`/presupuestos/${editId}`);
        return;
      }

      // Modo creación: Obtener el último quote_number para generar el correlativo entero siguiente
      const { data: latestQuote } = await supabase
        .from("quotes")
        .select("quote_number")
        .order("quote_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextQuoteNumber = latestQuote?.quote_number ? Number(latestQuote.quote_number) + 1 : 1;

      // 1. Insertar en tabla quotes
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          user_id: user.id,
          quote_number: nextQuoteNumber,
          client_name: clientName.trim(),
          client_contact: clientContact.trim() || null,
          delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : null,
          discount_percent: discountPercent || 0,
          subtotal: subtotal,
          total: total,
          notes: finalNotes,
        })
        .select()
        .single();

      if (quoteError || !quoteData) {
        throw new Error(quoteError?.message || "Error al crear presupuesto");
      }

      // 2. Insertar los items congelados en quote_items
      const quoteItemsToInsert = items.map((item) => ({
        quote_id: quoteData.id,
        product_name: item.productName,
        channel_name: item.channelName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.unitPrice * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("quote_items")
        .insert(quoteItemsToInsert);

      if (itemsError) {
        console.error("Error inserting quote items:", itemsError);
      }

      // Limpiar borrador de sesión
      try {
        sessionStorage.removeItem("haba_draft_nuevo_presupuesto");
      } catch {
        // ignore
      }

      // Redirigir a la vista previa oficial del presupuesto recién creado
      router.push(`/presupuestos/${quoteData.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al generar el presupuesto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4 pb-36">
      {/* Encabezado con Volver */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/presupuestos"
            className="p-2 bg-white hover:bg-neutral-100 text-neutral-600 rounded-2xl border border-neutral-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-neutral-800">
              {isEditing ? `Editar Presupuesto ${quoteNumber ? `#${quoteNumber}` : ""}` : "Nuevo Presupuesto"}
            </h2>
            <p className="text-xs text-neutral-500">
              {isEditing ? "Modificá los datos o ítems y guardá los cambios" : "Cotización con valores congelados y exportación"}
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Banner de Producto Preseleccionado */}
      {preselectedProductName && (
        <div className="p-3 bg-[#F0FAF4] border border-[#C3EBC0] rounded-2xl flex items-center justify-between text-xs text-[#1F7A4C] shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3BB578] flex-shrink-0" />
            <span>
              Producto <strong>"{preselectedProductName}"</strong> preseleccionado desde tu catálogo con su precio de venta sugerido.
            </span>
          </div>
          <button
            onClick={() => setPreselectedProductName(null)}
            className="text-neutral-400 hover:text-neutral-600 text-xs px-1.5 py-0.5"
            title="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tarjeta de Resumen Total */}
      <div className="bg-[#DCF4D7] border border-[#C3EBC0] p-4 rounded-3xl flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F7A4C] block">
            Total Presupuestado
          </span>
          <span className="text-xs text-[#1F7A4C]">
            Subtotal: {formatCurrency(subtotal)}
            {discountPercent > 0 && ` | Dcto: -${discountPercent}%`}
            {shippingCost > 0 && ` | Envío: +${formatCurrency(shippingCost)}`}
          </span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-[#1F7A4C]">
            {formatCurrency(total)}
          </span>
          <span className="text-[9px] block text-[#1F7A4C]">Valor final congelado</span>
        </div>
      </div>

      {/* Formulario: Datos del Cliente */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <User className="w-5 h-5 text-[#3BB578]" />
          <h3 className="text-sm font-bold text-neutral-800">1. Datos del Cliente</h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Nombre o Razón Social <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: Laura Gómez, Tienda Creaciones..."
              className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                <span>Teléfono / WhatsApp</span>
              </label>
              <input
                type="text"
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
                placeholder="Ej: +54 9 11 1234-5678"
                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Fecha Estimada de Entrega</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Formulario: Productos a Cotizar */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#3BB578]" />
            <div>
              <h3 className="text-sm font-bold text-neutral-800">2. Productos a Presupuestar</h3>
              <p className="text-[11px] text-neutral-400">
                Seleccioná el producto y el canal de venta aplicado
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsProductPickerOpen(true)}
            className="py-1.5 px-3 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-2xl text-xs font-bold flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center space-y-3 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
            <Receipt className="w-8 h-8 text-neutral-300 mx-auto" />
            <p className="text-xs text-neutral-500 max-w-[220px] mx-auto">
              Aún no agregaste productos a este presupuesto.
            </p>
            <button
              onClick={() => setIsProductPickerOpen(true)}
              className="py-2 px-4 bg-[#3BB578] text-white text-xs font-bold rounded-2xl shadow-sm"
            >
              Elegir del Catálogo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const lineTotal = item.unitPrice * item.quantity;

              return (
                <div
                  key={idx}
                  className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-800 block">
                        {item.productName}
                      </span>
                      <span className="text-[10px] text-[#1F7A4C] bg-[#DCF4D7] px-1.5 py-0.5 rounded-md font-semibold inline-block mt-0.5">
                        Canal: {item.channelName}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/50">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-semibold text-neutral-600">Cant:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItemQty(idx, parseInt(e.target.value) || 1)
                        }
                        className="w-16 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <label className="text-[11px] font-semibold text-neutral-600">Unit ($):</label>
                      <input
                        type="number"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-right font-bold outline-none focus:border-[#3BB578]"
                      />
                    </div>
                  </div>

                  <div className="text-right pt-1 border-t border-neutral-200/40">
                    <span className="text-[11px] text-neutral-400 mr-1">Subtotal ítem:</span>
                    <span className="text-xs font-black text-[#1F7A4C]">
                      {formatCurrency(lineTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Costo de Envío (Punto B) */}
        <div className="pt-3 border-t border-neutral-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#3BB578]" />
              <span>Costo de Envío ($)</span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs text-neutral-400 font-bold">$</span>
              <input
                type="number"
                min="0"
                step="any"
                value={shippingCost || ""}
                onChange={(e) => setShippingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-28 pl-6 pr-2.5 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-right font-bold outline-none focus:border-[#3BB578]"
              />
            </div>
          </div>
          <p className="text-[10.5px] text-neutral-400 italic bg-neutral-50/70 p-2 rounded-xl border border-neutral-200/50">
            🚚 Cotización al momento de presupuestar, sujeta a cambio de tarifa por la empresa de envío.
          </p>
        </div>

        {/* Descuento y Notas */}
        <div className="pt-3 border-t border-neutral-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-neutral-400" />
              <span>Descuento global (%)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="w-20 px-2.5 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
              />
              <span className="absolute right-2.5 top-1 text-xs text-neutral-400 font-bold">
                %
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              <span>Condiciones o notas para el cliente</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Seña del 50% al encargar. Validez de presupuesto: 7 días corridos..."
              className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none resize-none"
            />
          </div>
        </div>

        {/* Botón Emitir / Guardar con Estado de Error visible al pie (Punto C) */}
        <div className="pt-3 border-t border-neutral-100 space-y-2">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleSaveQuote}
            disabled={loading}
            className={`w-full py-3.5 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md ${
              errorMsg
                ? "bg-rose-600 hover:bg-rose-700 active:scale-[0.99] shadow-rose-200 ring-2 ring-rose-300"
                : "bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99]"
            } ${loading ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            {loading ? (
              <span>{isEditing ? "Guardando cambios..." : "Generando Presupuesto..."}</span>
            ) : errorMsg ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Revisar datos requeridos para emitir</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isEditing ? "Actualizar y Guardar Cambios" : "Emitir y Guardar Presupuesto"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Panel Sticky Inferior: Resumen en Tiempo Real */}
      <div className="sticky bottom-[62px] sm:bottom-[68px] z-40 -mx-1 mt-2">
        <div className="bg-white/95 backdrop-blur-md p-3 sm:p-3.5 rounded-3xl border border-[#C3EBC0] shadow-[0_-4px_25px_rgba(31,122,76,0.14)] flex items-center justify-between gap-3 transition-all duration-300">
          {/* Lado Izquierdo: Subtotal, Descuento e Ítems */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F7A4C] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3BB578] animate-pulse"></span>
                Resumen en vivo
              </span>
              <span className="text-[9px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-1.5 py-0.2 rounded-full">
                {items.length} {items.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-neutral-600 font-medium">
                Subtotal: <strong className="text-neutral-800">{formatCurrency(subtotal)}</strong>
              </span>

              {discountPercent > 0 ? (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md">
                  Dcto: -{discountPercent}% (-{formatCurrency(discountAmount)})
                </span>
              ) : (
                <span className="text-[10px] text-neutral-400">
                  Sin descuento
                </span>
              )}

              {shippingCost > 0 && (
                <span className="text-[10px] font-bold text-[#1F7A4C] bg-[#DCF4D7] border border-[#C3EBC0] px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                  🚚 Envío: +{formatCurrency(shippingCost)}
                </span>
              )}
            </div>
          </div>

          {/* Lado Derecho: Total Final Congelado */}
          <div className="text-right flex-shrink-0 bg-[#DCF4D7] border border-[#C3EBC0] px-3.5 py-1.5 rounded-2xl">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1F7A4C] block leading-none">
              Total Final
            </span>
            <span className="text-base sm:text-lg font-black text-[#1F7A4C] leading-tight block">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* MODAL SELECTOR DE PRODUCTOS Y PRECIOS */}
      {isProductPickerOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div 
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] flex flex-col animate-in slide-in-from-bottom-6"
            style={{
              height: 'min(88vh, 650px)',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 20px) - 10px)'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-neutral-800">Agregar Producto del Catálogo</h3>
              <button
                onClick={() => {
                  setIsProductPickerOpen(false);
                  setProductSearch("");
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* Buscador predictivo en tiempo real */}
            <div className="pt-3 pb-1 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar producto por nombre..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                  autoFocus
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch("")}
                    className="p-1 text-neutral-400 hover:text-neutral-600 absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 my-2 space-y-3 pr-1 overscroll-contain">
              {(() => {
                const filteredProducts = products.filter((p) =>
                  p.name.toLowerCase().includes(productSearch.toLowerCase().trim())
                );

                if (products.length === 0) {
                  return (
                    <div className="p-4 text-center text-xs text-neutral-500">
                      No tenés productos cargados en tu catálogo. Creá uno en Productos primero.
                    </div>
                  );
                }

                if (filteredProducts.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-neutral-400 space-y-1">
                      <p className="font-semibold text-neutral-600">No se encontraron productos</p>
                      <p className="text-[11px]">Probá buscando con otro término</p>
                    </div>
                  );
                }

                return filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2"
                  >
                    <span className="text-xs font-bold text-neutral-800 block">
                      {prod.name}
                    </span>

                    <div className="space-y-1.5">
                      {prod.product_prices && prod.product_prices.length > 0 ? (
                        prod.product_prices.map((price) => (
                          <button
                            key={price.id}
                            onClick={() => handleAddProduct(prod, price)}
                            className="w-full p-2.5 bg-white hover:bg-[#DCF4D7] border border-neutral-200 hover:border-[#3BB578] rounded-xl flex items-center justify-between text-xs transition"
                          >
                            <span className="font-semibold text-neutral-700">
                              {price.channel_name}
                            </span>
                            <span className="font-extrabold text-[#1F7A4C]">
                              {formatCurrency(price.selling_price)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <button
                          key="base"
                          onClick={() =>
                            handleAddProduct(prod, {
                              id: "base",
                              channel_name: "General",
                              profit_margin_percent: 0,
                              selling_price: prod.total_cost,
                            })
                          }
                          className="w-full p-2.5 bg-white hover:bg-[#DCF4D7] border border-neutral-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-neutral-700">Precio Base</span>
                          <span className="font-extrabold text-[#1F7A4C]">
                            {formatCurrency(prod.total_cost)}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div 
              className="pt-2 border-t border-neutral-100 flex-shrink-0"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 16px)' }}
            >
              <button
                onClick={() => setIsProductPickerOpen(false)}
                className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-2xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NuevoPresupuestoPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-neutral-400">
          Cargando presupuesto...
        </div>
      }
    >
      <NuevoPresupuestoContent />
    </Suspense>
  );
}
