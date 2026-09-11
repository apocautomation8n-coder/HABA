"use client";

import React, { useEffect, useState } from "react";
import { X, Sparkles, AlertCircle, Calculator, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UNIT_PRESETS, calculateUnitCost, formatCurrency } from "@/lib/units";

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

  const [category, setCategory] = useState<"materia_prima" | "packaging">("materia_prima");
  const [name, setName] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("kg");
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number | string>("");
  const [useUnit, setUseUnit] = useState("g");
  const [conversionFactor, setConversionFactor] = useState<number>(1000);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("kg-g");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSupply) {
      setName(initialSupply.name || "");
      setCategory(initialSupply.category === "packaging" ? "packaging" : "materia_prima");
      setPurchaseUnit(initialSupply.purchase_unit || "kg");
      setPurchaseQuantity(initialSupply.purchase_quantity || 1);
      setCurrentPrice(initialSupply.current_price || "");
      setUseUnit(initialSupply.use_unit || "g");
      setConversionFactor(initialSupply.conversion_factor || 1000);

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
      setPurchaseQuantity(1);
      setCurrentPrice("");
      setUseUnit("g");
      setConversionFactor(1000);
      setSelectedPresetId("kg-g");
      setError(null);
    }
  }, [initialSupply, isOpen]);

  if (!isOpen) return null;

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
  const unitCost = calculateUnitCost(parsedPrice, purchaseQuantity, conversionFactor);
  const totalRecipeUnits = purchaseQuantity * conversionFactor;
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
    if (purchaseQuantity <= 0) {
      setError("La cantidad comprada debe ser mayor a 0");
      return;
    }
    if (conversionFactor <= 0) {
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
        // Actualizar existente (trigger guardará historial si cambia precio)
        const { error: updateError } = await supabase
          .from("supplies")
          .update({
            name: name.trim(),
            category,
            purchase_unit: purchaseUnit.trim(),
            purchase_quantity: purchaseQuantity,
            current_price: parsedPrice,
            use_unit: useUnit.trim(),
            conversion_factor: conversionFactor,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialSupply.id);

        if (updateError) throw updateError;
      } else {
        // Insertar nuevo insumo
        const { error: insertError } = await supabase.from("supplies").insert({
          user_id: user.id,
          name: name.trim(),
          category,
          purchase_unit: purchaseUnit.trim(),
          purchase_quantity: purchaseQuantity,
          current_price: parsedPrice,
          use_unit: useUnit.trim(),
          conversion_factor: conversionFactor,
        });

        if (insertError) throw insertError;
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

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-[#EAF0E8] animate-in fade-in slide-in-from-bottom-6 duration-200" 
        style={{ 
          height: 'min(92vh, 740px)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 20px) - 10px)'
        }}
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

            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#2B2B2B]">Tipo de Insumo</label>
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
                <label className="text-[11px] font-semibold text-[#2B2B2B]">Conversión de Unidades</label>
                <span className="text-[10px] text-[#7A7A7A]">Automático</span>
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
                <label className="text-[11px] font-semibold text-[#2B2B2B]">Cantidad Comprada *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(parseFloat(e.target.value) || 0)}
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
                <label className="text-[11px] font-semibold text-[#2B2B2B]">
                  Precio de Reposición ($ ARS) *
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
            </div>

            {/* Unidad de Uso y Factor de Conversión */}
            <div className="space-y-2 bg-[#F6F7F2] p-3 rounded-2xl border border-[#EAF0E8]">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-semibold text-[#7A7A7A]">Unidad en Receta *</label>
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
                      setConversionFactor(parseFloat(e.target.value) || 1);
                      setSelectedPresetId("custom");
                    }}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl outline-none text-[#2B2B2B]"
                  />
                </div>
              </div>

              {/* Explicación didáctica del rendimiento */}
              <div className="text-[10.5px] text-[#7A7A7A] pt-1 border-t border-neutral-200/50">
                📦 Comprás <strong className="text-[#2B2B2B]">{purchaseQuantity} {purchaseUnit}</strong> = Tenés <strong className="text-[#1F7A4C]">{totalRecipeUnits} {useUnit}</strong> disponibles para usar en recetas.
              </div>
            </div>

            {/* Tarjeta de Cálculo en Vivo */}
            <div className="bg-[#DCF4D7] border border-[#C3EBC0] p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#1F7A4C]" />
                <div>
                  <p className="text-[10.5px] font-bold text-[#1F7A4C]">Costo Unitario de Uso:</p>
                  <p className="text-[10px] text-[#2E9E65]">
                    1 {useUnit} = {formatCurrency(unitCost)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-[#1F7A4C] font-display">
                  {formatCurrency(unitCost)}
                </span>
                <span className="text-[9.5px] block text-[#1F7A4C]">por {useUnit}</span>
              </div>
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
};
