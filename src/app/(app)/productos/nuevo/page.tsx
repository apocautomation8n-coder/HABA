"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Percent,
  Calculator,
  Layers,
  ChevronRight,
  Package,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, calculateUnitCost } from "@/lib/units";
import { SupplyItem } from "@/components/SupplyModal";

interface SelectedSupply {
  supply: SupplyItem;
  quantity: number; // en use_unit
}

interface ChannelPrice {
  channel_name: string;
  profit_margin_percent: number;
  selling_price: number;
}

const DEFAULT_CHANNELS = [
  { name: "Minorista (Precio Regular)", defaultMargin: 100 },
  { name: "Mayorista (Por Cantidad)", defaultMargin: 40 },
  { name: "Feria / Presencial", defaultMargin: 80 },
  { name: "Online / Tienda Web", defaultMargin: 120 },
];

export default function NuevoProductoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Insumos disponibles en DB
  const [availableSupplies, setAvailableSupplies] = useState<SupplyItem[]>([]);
  const [loadingSupplies, setLoadingSupplies] = useState(true);

  // Configuración de Mano de Obra del usuario
  const [laborMinuteRate, setLaborMinuteRate] = useState<number>(0);

  // Datos del Producto - Paso 1: Básicos
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Paso 2: Insumos & Packaging (Receta)
  const [selectedSupplies, setSelectedSupplies] = useState<SelectedSupply[]>([]);
  const [supplyPickerOpen, setSupplyPickerOpen] = useState(false);

  // Paso 3: Mano de Obra (Opcional)
  const [includeLabor, setIncludeLabor] = useState(true);
  const [workTimeMinutes, setWorkTimeMinutes] = useState<number>(30);

  // Paso 4: Gastos Indirectos / Fijos (Opcional prorrateo sugerido)
  const [indirectCost, setIndirectCost] = useState<number>(0);

  // Paso 5: Precios Multicanal
  const [channelPrices, setChannelPrices] = useState<ChannelPrice[]>(
    DEFAULT_CHANNELS.map((ch) => ({
      channel_name: ch.name,
      profit_margin_percent: ch.defaultMargin,
      selling_price: 0,
    }))
  );

  // Cargar insumos y mano de obra
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingSupplies(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Cargar insumos
          const { data: suppliesData } = await supabase
            .from("supplies")
            .select("*")
            .order("name", { ascending: true });

          if (suppliesData) {
            setAvailableSupplies(suppliesData as SupplyItem[]);
          }

          // Cargar mano de obra
          const { data: laborData } = await supabase
            .from("labor_settings")
            .select("minute_rate")
            .eq("user_id", user.id)
            .single();

          if (laborData && laborData.minute_rate) {
            setLaborMinuteRate(laborData.minute_rate);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoadingSupplies(false);
      }
    };

    fetchData();
  }, [supabase]);

  // Cálculos reactivos de costos
  // 1. Costo directo de materiales (Insumos + Packaging)
  const directCost = useMemo(() => {
    return selectedSupplies.reduce((acc, item) => {
      const unitCost = calculateUnitCost(
        item.supply.current_price,
        item.supply.purchase_quantity,
        item.supply.conversion_factor
      );
      return acc + unitCost * (item.quantity || 0);
    }, 0);
  }, [selectedSupplies]);

  // 2. Costo de Mano de Obra
  const laborCost = useMemo(() => {
    if (!includeLabor) return 0;
    return (workTimeMinutes || 0) * (laborMinuteRate || 0);
  }, [includeLabor, workTimeMinutes, laborMinuteRate]);

  // 3. Costo Total Unitario
  const totalCost = useMemo(() => {
    return directCost + laborCost + (Number(indirectCost) || 0);
  }, [directCost, laborCost, indirectCost]);

  // Actualizar precios de canales cuando cambia el totalCost
  useEffect(() => {
    setChannelPrices((prev) =>
      prev.map((ch) => {
        const calculatedPrice = totalCost * (1 + ch.profit_margin_percent / 100);
        return {
          ...ch,
          selling_price: Math.round(calculatedPrice),
        };
      })
    );
  }, [totalCost]);

  // Modificar margen y recalcular precio de un canal
  const handleMarginChange = (index: number, margin: number) => {
    setChannelPrices((prev) => {
      const updated = [...prev];
      const newPrice = totalCost * (1 + margin / 100);
      updated[index] = {
        ...updated[index],
        profit_margin_percent: margin,
        selling_price: Math.round(newPrice),
      };
      return updated;
    });
  };

  // Modificar precio final y recalcular margen de un canal
  const handlePriceChange = (index: number, price: number) => {
    setChannelPrices((prev) => {
      const updated = [...prev];
      let newMargin = 0;
      if (totalCost > 0) {
        newMargin = Math.round(((price - totalCost) / totalCost) * 100);
      }
      updated[index] = {
        ...updated[index],
        profit_margin_percent: newMargin,
        selling_price: price,
      };
      return updated;
    });
  };

  // Agregar insumo a la receta
  const handleAddSupply = (supply: SupplyItem) => {
    if (selectedSupplies.some((s) => s.supply.id === supply.id)) return;
    setSelectedSupplies((prev) => [...prev, { supply, quantity: 1 }]);
    setSupplyPickerOpen(false);
  };

  // Cambiar cantidad de insumo
  const handleUpdateSupplyQty = (index: number, qty: number) => {
    setSelectedSupplies((prev) => {
      const updated = [...prev];
      updated[index].quantity = qty;
      return updated;
    });
  };

  // Quitar insumo de la receta
  const handleRemoveSupply = (index: number) => {
    setSelectedSupplies((prev) => prev.filter((_, i) => i !== index));
  };

  // Guardar en Supabase
  const handleSaveProduct = async () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg("El nombre del producto es obligatorio");
      setCurrentStep(1);
      return;
    }
    if (selectedSupplies.length === 0) {
      setErrorMsg("Debes agregar al menos un insumo o packaging");
      setCurrentStep(2);
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sesión no válida");

      // 1. Insertar en tabla products
      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          work_time_minutes: includeLabor ? workTimeMinutes : 0,
          include_labor: includeLabor,
          direct_cost: directCost,
          labor_cost: laborCost,
          indirect_cost: Number(indirectCost) || 0,
          total_cost: totalCost,
          needs_price_review: false,
        })
        .select()
        .single();

      if (productError || !productData) {
        throw new Error(productError?.message || "Error al crear el producto");
      }

      const productId = productData.id;

      // 2. Insertar insumos de la receta en product_supplies
      const suppliesToInsert = selectedSupplies.map((s) => ({
        product_id: productId,
        supply_id: s.supply.id,
        quantity: s.quantity,
      }));

      const { error: suppliesError } = await supabase
        .from("product_supplies")
        .insert(suppliesToInsert);

      if (suppliesError) {
        console.error("Error inserting product supplies:", suppliesError);
      }

      // 3. Insertar precios de canales en product_prices
      const pricesToInsert = channelPrices.map((cp) => ({
        product_id: productId,
        channel_name: cp.channel_name,
        profit_margin_percent: cp.profit_margin_percent,
        selling_price: cp.selling_price,
      }));

      const { error: pricesError } = await supabase
        .from("product_prices")
        .insert(pricesToInsert);

      if (pricesError) {
        console.error("Error inserting product prices:", pricesError);
      }

      // Redirigir a listado de productos
      router.push("/productos");
    } catch (err: any) {
      setErrorMsg(err.message || "Error inesperado al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Encabezado con Volver */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/productos"
            className="p-2 bg-white hover:bg-neutral-100 text-neutral-600 rounded-2xl border border-neutral-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-neutral-800">Nuevo Producto</h2>
            <p className="text-xs text-neutral-500">Calculadora de costo y fijación de precios</p>
          </div>
        </div>
      </div>

      {/* Barra de Pasos Kawaii */}
      <div className="bg-white p-3 rounded-3xl border border-[#EAF0E8] shadow-sm flex items-center justify-between text-xs">
        {[
          { step: 1, label: "Detalles" },
          { step: 2, label: "Insumos" },
          { step: 3, label: "Mano Obra" },
          { step: 4, label: "Precios" },
        ].map((item) => (
          <button
            key={item.step}
            onClick={() => setCurrentStep(item.step)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-bold transition ${
              currentStep === item.step
                ? "bg-[#3BB578] text-white shadow-sm"
                : currentStep > item.step
                ? "bg-[#DCF4D7] text-[#1F7A4C]"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === item.step
                  ? "bg-white text-[#3BB578]"
                  : currentStep > item.step
                  ? "bg-[#1F7A4C] text-white"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {currentStep > item.step ? "✓" : item.step}
            </span>
            <span className="hidden xs:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Resumen Flotante / Tarjeta de Costo en Vivo */}
      <div className="bg-[#DCF4D7] border border-[#C3EBC0] p-3.5 rounded-3xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <Calculator className="w-5 h-5 text-[#1F7A4C]" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F7A4C] block">
              Costo Unitario en Vivo
            </span>
            <span className="text-xs text-[#1F7A4C]">
              Mat: {formatCurrency(directCost)}
              {includeLabor && ` | M.O: ${formatCurrency(laborCost)}`}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-[#1F7A4C]">
            {formatCurrency(totalCost)}
          </span>
          <span className="text-[9px] block text-[#1F7A4C]">Costo total por unidad</span>
        </div>
      </div>

      {/* PASO 1: Datos Básicos */}
      {currentStep === 1 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <ShoppingBag className="w-5 h-5 text-[#3BB578]" />
            <h3 className="text-sm font-bold text-neutral-800">1. Datos del Producto</h3>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Nombre del Producto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Libreta A5 Cuero Artesanal, Vela de Soja 200g..."
              className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Descripción o Detalles (opcional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Medidas, tipo de papel, encuadernación, aromas o notas para la producción..."
              className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!name.trim()}
              className="py-2.5 px-5 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Siguiente: Insumos</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Receta de Insumos & Packaging */}
      {currentStep === 2 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#3BB578]" />
              <div>
                <h3 className="text-sm font-bold text-neutral-800">2. Insumos & Packaging</h3>
                <p className="text-[11px] text-neutral-400">
                  Agregá lo que consume 1 sola unidad de este producto
                </p>
              </div>
            </div>
            <button
              onClick={() => setSupplyPickerOpen(true)}
              className="py-1.5 px-3 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-2xl text-xs font-bold flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </div>

          {selectedSupplies.length === 0 ? (
            <div className="py-8 text-center space-y-3 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              <Package className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-xs text-neutral-500 max-w-[200px] mx-auto">
                Aún no agregaste insumos ni packaging a esta receta.
              </p>
              <button
                onClick={() => setSupplyPickerOpen(true)}
                className="py-2 px-4 bg-[#3BB578] text-white text-xs font-bold rounded-2xl shadow-sm"
              >
                Elegir insumo
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedSupplies.map((item, idx) => {
                const unitCost = calculateUnitCost(
                  item.supply.current_price,
                  item.supply.purchase_quantity,
                  item.supply.conversion_factor
                );
                const subtotal = unitCost * item.quantity;

                return (
                  <div
                    key={item.supply.id || idx}
                    className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-neutral-800">
                          {item.supply.name}
                        </span>
                        <span className="text-[10px] block text-neutral-400">
                          Costo: {formatCurrency(unitCost)} / {item.supply.use_unit}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveSupply(idx)}
                        className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-neutral-600">
                          Cantidad usada:
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateSupplyQty(idx, parseFloat(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                          />
                          <span className="text-xs font-semibold text-neutral-500">
                            {item.supply.use_unit}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-[#1F7A4C]">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="py-2 px-4 bg-neutral-100 text-neutral-600 rounded-2xl text-xs font-semibold"
            >
              Atrás
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              disabled={selectedSupplies.length === 0}
              className="py-2.5 px-5 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Siguiente: Mano de Obra</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Mano de Obra & Prorrateo */}
      {currentStep === 3 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Clock className="w-5 h-5 text-[#3BB578]" />
            <div>
              <h3 className="text-sm font-bold text-neutral-800">3. Mano de Obra y Costos Indirectos</h3>
              <p className="text-[11px] text-neutral-400">
                La mano de obra es opcional por si solo querés costear materiales
              </p>
            </div>
          </div>

          {/* Toggle Mano de Obra */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-800 block">
                  ¿Incluir tu tiempo de confección?
                </span>
                <span className="text-[10px] text-neutral-400">
                  {laborMinuteRate > 0
                    ? `Tu valor configurado: ${formatCurrency(laborMinuteRate)} / minuto`
                    : "No configuraste tu sueldo aún en Gastos"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeLabor(!includeLabor)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                  includeLabor ? "bg-[#3BB578]" : "bg-neutral-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                    includeLabor ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            {includeLabor && (
              <div className="pt-2 border-t border-neutral-200/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700">
                    Tiempo de elaboración (minutos):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={workTimeMinutes}
                      onChange={(e) => setWorkTimeMinutes(parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                    />
                    <span className="text-xs text-neutral-500 font-medium">min</span>
                  </div>
                </div>

                <div className="bg-[#DCF4D7] p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-[#1F7A4C] font-semibold">Costo por tu tiempo:</span>
                  <span className="font-extrabold text-[#1F7A4C]">
                    {formatCurrency(laborCost)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Gastos Indirectos prorrateados (opcional) */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">
                Prorrateo de Gastos Fijos (opcional):
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-neutral-400">$</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={indirectCost}
                  onChange={(e) => setIndirectCost(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-24 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-right font-bold outline-none focus:border-[#3BB578]"
                />
              </div>
            </div>
            <p className="text-[10px] text-neutral-400">
              Monto estimado de luz/taller/alquiler asignado a cada unidad.
            </p>
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="py-2 px-4 bg-neutral-100 text-neutral-600 rounded-2xl text-xs font-semibold"
            >
              Atrás
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="py-2.5 px-5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Siguiente: Precios Multicanal</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Precios Multicanal & Margen de Ganancia */}
      {currentStep === 4 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <TrendingUp className="w-5 h-5 text-[#3BB578]" />
            <div>
              <h3 className="text-sm font-bold text-neutral-800">4. Precios por Canal de Venta</h3>
              <p className="text-[11px] text-neutral-400">
                Un solo costo, distintos márgenes según dónde lo vendas
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {channelPrices.map((channel, idx) => {
              const profitAmount = channel.selling_price - totalCost;

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800">
                      {channel.channel_name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        profitAmount >= 0
                          ? "bg-[#DCF4D7] text-[#1F7A4C]"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      Ganás {formatCurrency(profitAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Margen % */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-neutral-600 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-neutral-400" />
                        <span>Margen Deseado</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={channel.profit_margin_percent}
                          onChange={(e) =>
                            handleMarginChange(idx, parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl font-bold outline-none focus:border-[#3BB578]"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs text-neutral-400 font-bold">
                          %
                        </span>
                      </div>
                    </div>

                    {/* Precio Final $ */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-neutral-600 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-neutral-400" />
                        <span>Precio de Venta</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={channel.selling_price}
                        onChange={(e) =>
                          handlePriceChange(idx, parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl font-bold text-[#1F7A4C] outline-none focus:border-[#3BB578]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(3)}
              className="py-2 px-4 bg-neutral-100 text-neutral-600 rounded-2xl text-xs font-semibold"
            >
              Atrás
            </button>
            <button
              onClick={handleSaveProduct}
              disabled={loading}
              className="py-3 px-6 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-60 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
            >
              {loading ? (
                <span>Guardando Producto...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar en mi Catálogo</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODAL SELECCIONADOR DE INSUMOS */}
      {supplyPickerOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] flex flex-col animate-in slide-in-from-bottom-6"
            style={{
              height: 'min(88vh, 600px)',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 20px) - 10px)'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-neutral-800">Elegir Insumo o Packaging</h3>
              <button
                onClick={() => setSupplyPickerOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 my-3 space-y-2 pr-1 overscroll-contain">
              {availableSupplies.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">
                  No tenés insumos cargados. Creá uno en el módulo Insumos primero.
                </div>
              ) : (
                availableSupplies.map((sup) => {
                  const isSelected = selectedSupplies.some((s) => s.supply.id === sup.id);
                  const unitCost = calculateUnitCost(
                    sup.current_price,
                    sup.purchase_quantity,
                    sup.conversion_factor
                  );

                  return (
                    <button
                      key={sup.id}
                      disabled={isSelected}
                      onClick={() => handleAddSupply(sup)}
                      className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? "bg-neutral-100 border-neutral-200 opacity-50 cursor-not-allowed"
                          : "bg-white hover:bg-[#DCF4D7]/50 border-neutral-200 hover:border-[#3BB578]"
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-neutral-800 block">
                          {sup.name}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {sup.category === "packaging" ? "📦 Packaging" : "🧵 Materia Prima"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#1F7A4C]">
                          {formatCurrency(unitCost)}
                        </span>
                        <span className="text-[9px] block text-neutral-400">
                          por {sup.use_unit}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div
              className="pt-2 border-t border-neutral-100 flex-shrink-0"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 16px)' }}
            >
              <button
                onClick={() => setSupplyPickerOpen(false)}
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
