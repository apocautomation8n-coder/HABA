"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, AlertCircle, Calculator, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UNIT_PRESETS, calculateUnitCost, formatCurrency } from "@/lib/units";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";

export interface SupplyItem {
  id?: string;
  name: string;
  category: "materia_prima" | "packaging" | "otro";
  purchase_unit: string;
  purchase_quantity: number;
  current_price: number;
  use_unit: string;
  conversion_factor: number;
  created_at?: string;
  updated_at?: string;
}

interface SupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSupply?: SupplyItem | null;
}

export const SupplyModal: React.FC<SupplyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSupply,
}) => {
  const supabase = createClient();
  useModalThemeColor(isOpen);

  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<"materia_prima" | "packaging">("materia_prima");
  const [name, setName] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("kg");
  const [purchaseQuantity, setPurchaseQuantity] = useState<number | string>("");
  const [currentPrice, setCurrentPrice] = useState<number | string>("");
  const [useUnit, setUseUnit] = useState("g");
  const [conversionFactor, setConversionFactor] = useState<number | string>(1000);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("kg-g");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Oscurecer status bar nativo en móviles y bloquear scroll del fondo cuando el modal está abierto
  useEffect(() => {
    if (!isOpen) return;

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const originalThemeColor = metaThemeColor?.getAttribute("content") || "#3BB578";
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#000000");
    }

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", originalThemeColor);
      }
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  useEffect(() => {
    if (initialSupply) {
      setName(initialSupply.name || "");
      setCategory(initialSupply.category === "packaging" ? "packaging" : "materia_prima");
      setPurchaseUnit(initialSupply.purchase_unit || "kg");
      setPurchaseQuantity(initialSupply.purchase_quantity ?? "");
      setCurrentPrice(initialSupply.current_price ?? "");
      setUseUnit(initialSupply.use_unit || "g");
      setConversionFactor(initialSupply.conversion_factor ?? 1000);

      // Detect matched preset if any
      const matchingPreset = UNIT_PRESETS.find(
        (p) =>
          p.purchaseUnit.toLowerCase() === (initialSupply.purchase_unit || "").toLowerCase() &&
          p.useUnit.toLowerCase() === (initialSupply.use_unit || "").toLowerCase() &&
          p.defaultFactor === initialSupply.conversion_factor
      );
      setSelectedPresetId(matchingPreset ? matchingPreset.id : "custom");
    } else {
      setName("");
      setCategory("materia_prima");
      setPurchaseUnit("kg");
      setPurchaseQuantity("");
      setCurrentPrice("");
      setUseUnit("g");
      setConversionFactor(1000);
      setSelectedPresetId("kg-g");
      setError(null);
    }
  }, [initialSupply, isOpen]);

  if (!isOpen || !mounted) return null;

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = UNIT_PRESETS.find((p) => p.id === presetId);
    if (preset && preset.id !== "custom") {
      setPurchaseUnit(preset.purchaseUnit);
      setUseUnit(preset.useUnit);
      setConversionFactor(preset.defaultFactor);
    }
  };

  const parsedPrice = typeof currentPrice === "number" ? currentPrice : parseFloat(currentPrice) || 0;
  const parsedQuantity = typeof purchaseQuantity === "number" ? purchaseQuantity : parseFloat(String(purchaseQuantity)) || 0;
  const parsedConversion = typeof conversionFactor === "number" ? conversionFactor : parseFloat(String(conversionFactor)) || 0;
  const unitCost = calculateUnitCost(parsedPrice, parsedQuantity, parsedConversion);
  const totalRecipeUnits = parsedQuantity * parsedConversion;
  const activePreset = UNIT_PRESETS.find((p) => p.id === selectedPresetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Por favor ingresá un nombre para el insumo");
      return;
    }
    if (parsedPrice <= 0) {
      setError("El precio de reposición debe ser mayor a 0");
      return;
    }
    if (parsedQuantity <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }
    if (parsedConversion <= 0) {
      setError("El factor de rendimiento debe ser mayor a 0");
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sesión expirada. Por favor volvé a iniciar sesión.");
        return;
      }

      if (initialSupply?.id) {
        const nowIso = new Date().toISOString();
        const priceChanged = parsedPrice !== initialSupply.current_price;

        // Si el precio cambió, registrarlo en la cronología (supply_price_history)
        if (priceChanged) {
          const { data: existingHistory } = await supabase
            .from("supply_price_history")
            .select("id")
            .eq("supply_id", initialSupply.id)
            .limit(1);

          // Si no tenía registros previos, guardamos el precio anterior como hito inicial
          if (!existingHistory || existingHistory.length === 0) {
            if (initialSupply.current_price && initialSupply.current_price > 0) {
              await supabase.from("supply_price_history").insert({
                supply_id: initialSupply.id,
                price: initialSupply.current_price,
                changed_at: initialSupply.updated_at || initialSupply.created_at || nowIso,
              });
            }
          }

          // Guardar el nuevo precio en el historial
          await supabase.from("supply_price_history").insert({
            supply_id: initialSupply.id,
            price: parsedPrice,
            changed_at: nowIso,
          });
        }

        const { error: updateError } = await supabase
          .from("supplies")
          .update({
            name: name.trim(),
            category,
            purchase_unit: purchaseUnit.trim(),
            purchase_quantity: parsedQuantity,
            current_price: parsedPrice,
            use_unit: useUnit.trim(),
            conversion_factor: parsedConversion,
            updated_at: nowIso,
          })
          .eq("id", initialSupply.id);

        if (updateError) throw updateError;
      } else {
        // Insertar nuevo insumo
        const nowIso = new Date().toISOString();
        const { data: newSupply, error: insertError } = await supabase
          .from("supplies")
          .insert({
            user_id: user.id,
            name: name.trim(),
            category,
            purchase_unit: purchaseUnit.trim(),
            purchase_quantity: parsedQuantity,
            current_price: parsedPrice,
            use_unit: useUnit.trim(),
            conversion_factor: parsedConversion,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Registrar precio inicial en el historial
        if (newSupply?.id) {
          await supabase.from("supply_price_history").insert({
            supply_id: newSupply.id,
            price: parsedPrice,
            changed_at: nowIso,
          });
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving supply:", err);
      setError(err.message || "Error al guardar el insumo");
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      className="fixed -top-40 -bottom-40 -left-20 -right-20 z-[99999] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center pt-40 pb-40 px-20 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-[#EAF0E8] animate-in slide-in-from-bottom-6 duration-200 overflow-hidden" 
        style={{ 
          height: 'min(92vh, 740px)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 20px) - 10px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header fijo */}
        <div className="p-4 pb-3 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#DCF4D7] text-[#3BB578] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[#2B2B2B] font-display">
              {initialSupply ? "Editar Insumo" : "Nuevo Insumo o Packaging"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable del formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden font-body">
          <div className="overflow-y-auto px-4 py-3 space-y-3.5 flex-1 min-h-0 overscroll-contain">
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Banner Didáctico HABA */}
            <div className="bg-[#F0FAF4] border border-[#DCF4D7] p-3 rounded-2xl flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] leading-snug text-[#2B2B2B] space-y-0.5">
                <p className="font-bold text-[#1F7A4C]">¿Cómo calcula HABA el costo?</p>
                <p className="text-[#555]">
                  Ingresás cuánto comprás (ej: <strong>1 paquete</strong> de <strong>$5.000</strong>) y cuánto te rinde (ej: <strong>50 bolsas</strong>). HABA calcula el valor exacto por unidad de uso (<strong>$100 c/u</strong>) para que tus productos siempre tengan el costo real al día.
                </p>
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#2B2B2B] flex items-center gap-1">
                  <span>Tipo de Insumo</span>
                </label>
                <span className="text-[10px] text-[#7A7A7A]">
                  {category === "materia_prima" ? "Materia que compone el producto" : "Cajas, bolsas o empaques"}
                </span>
              </div>
              <div className="flex bg-[#F6F7F2] p-1 rounded-2xl gap-1 border border-[#EAF0E8]">
                <button
                  type="button"
                  onClick={() => setCategory("materia_prima")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                    category === "materia_prima"
                      ? "bg-white text-[#1F7A4C] shadow-xs"
                      : "text-[#7A7A7A] hover:text-[#2B2B2B]"
                  }`}
                >
                  🧵 Materia Prima
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("packaging")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                    category === "packaging"
                      ? "bg-white text-[#1F7A4C] shadow-xs"
                      : "text-[#7A7A7A] hover:text-[#2B2B2B]"
                  }`}
                >
                  📦 Packaging
                </button>
              </div>
            </div>

            {/* Nombre */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#2B2B2B]">Nombre del Insumo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={category === "packaging" ? "Ej: Caja 15x15, Sobre Kraft..." : "Ej: Cera de Soja, Tela, Cartón..."}
                required
                className="w-full px-3 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition text-[#2B2B2B]"
              />
            </div>

            {/* Preset de Unidades */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#2B2B2B] flex items-center gap-1">
                  <span>Conversión de Unidades</span>
                  <span className="text-[9.5px] bg-[#DCF4D7] text-[#1F7A4C] px-1.5 py-0.2 rounded font-medium">Asistente</span>
                </label>
                <span className="text-[10px] text-[#7A7A7A]">Reglas automáticas</span>
              </div>
              <select
                value={selectedPresetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition text-[#2B2B2B]"
              >
                {UNIT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {activePreset && activePreset.example && (
                <p className="text-[10.5px] text-[#7A7A7A] italic px-1 flex items-center gap-1 mt-0.5">
                  <Info className="w-3 h-3 text-[#3BB578] flex-shrink-0" />
                  <span>{activePreset.example}</span>
                </p>
              )}
            </div>

            {/* Cantidad y Unidad de Compra */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#2B2B2B] flex items-center justify-between">
                  <span>Cantidad *</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(e.target.value)}
                  placeholder="1"
                  required
                  className="w-full px-3 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#2B2B2B]">Unidad de Compra *</label>
                <input
                  type="text"
                  value={purchaseUnit}
                  onChange={(e) => {
                    setPurchaseUnit(e.target.value);
                    setSelectedPresetId("custom");
                  }}
                  placeholder="kg, metro, pack..."
                  required
                  className="w-full px-3 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                />
              </div>
            </div>

            {/* Precio de Reposición Actual */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#2B2B2B] flex items-center gap-1">
                  <span>Precio de Reposición ($ ARS) *</span>
                </label>
                <span className="text-[9.5px] text-[#1F7A4C] bg-[#DCF4D7] px-1.5 py-0.5 rounded-md font-medium">
                  Al día de hoy
                </span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#7A7A7A] font-bold text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-3 py-2 text-xs font-semibold text-[#2B2B2B] bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                />
              </div>
              <p className="text-[10px] text-[#7A7A7A] px-1">
                ℹ️ ¿Cuánto pagarías hoy por volver a comprarlo? Mantener este precio al día protege tus ganancias de la inflación.
              </p>
            </div>

            {/* Unidad de Uso y Factor de Conversión */}
            <div className="space-y-2 bg-[#F6F7F2] p-3 rounded-2xl border border-[#EAF0E8]">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-semibold text-[#7A7A7A]">Unidad de Uso *</label>
                  <input
                    type="text"
                    value={useUnit}
                    onChange={(e) => {
                      setUseUnit(e.target.value);
                      setSelectedPresetId("custom");
                    }}
                    placeholder="g, cm, u..."
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl outline-none text-[#2B2B2B]"
                  />
                  <span className="text-[9.5px] text-[#999] block px-0.5">Cómo lo medís en tu producto</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10.5px] font-semibold text-[#7A7A7A]">
                    Rinde por 1 {purchaseUnit || "compra"} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    value={conversionFactor}
                    onChange={(e) => {
                      setConversionFactor(e.target.value);
                      setSelectedPresetId("custom");
                    }}
                    placeholder="1000"
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl outline-none text-[#2B2B2B]"
                  />
                  <span className="text-[9.5px] text-[#999] block px-0.5">Equivalente en {useUnit}</span>
                </div>
              </div>

              {/* Explicación didáctica del rendimiento */}
              <div className="text-[10.5px] text-[#7A7A7A] pt-1.5 border-t border-neutral-200/60 leading-tight">
                📦 Comprás <strong className="text-[#2B2B2B]">{purchaseQuantity} {purchaseUnit}</strong> = Tenés <strong className="text-[#1F7A4C]">{totalRecipeUnits} {useUnit}</strong> disponibles para fabricar tus productos.
              </div>
            </div>

            {/* Tarjeta de Cálculo en Vivo y Desglose Didáctico */}
            <div className="bg-[#DCF4D7]/80 border border-[#C3EBC0] p-3 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#3BB578] text-white flex items-center justify-center">
                    <Calculator className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#1F7A4C]">Costo unitario de uso:</p>
                    <p className="text-[10px] text-[#2E9E65] font-medium">
                      1 {useUnit} = {formatCurrency(unitCost)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm sm:text-base font-black text-[#1F7A4C] font-display">
                    {formatCurrency(unitCost)}
                  </span>
                  <span className="text-[9.5px] block text-[#1F7A4C] font-medium">por cada {useUnit}</span>
                </div>
              </div>

              {parsedPrice > 0 && totalRecipeUnits > 0 && (
                <div className="pt-2 border-t border-[#C3EBC0]/70 text-[10px] text-[#1F7A4C] flex items-center justify-between bg-white/70 px-2.5 py-1.5 rounded-xl font-medium">
                  <span>💡 Fórmula:</span>
                  <span>
                    {formatCurrency(parsedPrice)} ÷ {totalRecipeUnits} {useUnit} = <strong>{formatCurrency(unitCost)}/{useUnit}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Fijo: Botones SIEMPRE visibles y bien acomodados en mobile */}
          <div 
            className="p-3.5 border-t border-neutral-100 bg-white flex gap-2 flex-shrink-0 rounded-b-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.05)]" 
            style={{ 
              paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 20px)' 
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-[#7A7A7A] rounded-2xl text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition shadow-sm disabled:opacity-60"
            >
              {loading ? "Guardando..." : initialSupply ? "Actualizar Insumo" : "Guardar Insumo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
