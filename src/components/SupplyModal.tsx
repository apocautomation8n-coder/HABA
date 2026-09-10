"use client";

import React, { useEffect, useState } from "react";
import { X, Sparkles, AlertCircle, Calculator } from "lucide-react";
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

  const [name, setName] = useState("");
  const [category, setCategory] = useState<"materia_prima" | "packaging" | "otro">("materia_prima");
  const [selectedPresetId, setSelectedPresetId] = useState("kg-g");
  const [purchaseUnit, setPurchaseUnit] = useState("kg");
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number | string>("");
  const [useUnit, setUseUnit] = useState("g");
  const [conversionFactor, setConversionFactor] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSupply) {
      setName(initialSupply.name);
      setCategory(initialSupply.category);
      setPurchaseUnit(initialSupply.purchase_unit);
      setPurchaseQuantity(initialSupply.purchase_quantity);
      setCurrentPrice(initialSupply.current_price);
      setUseUnit(initialSupply.use_unit);
      setConversionFactor(initialSupply.conversion_factor);

      // Buscar si coincide con algún preset
      const match = UNIT_PRESETS.find(
        (p) =>
          p.purchaseUnit === initialSupply.purchase_unit &&
          p.useUnit === initialSupply.use_unit
      );
      if (match) setSelectedPresetId(match.id);
      else setSelectedPresetId("custom");
    } else {
      // Reset defaults para nuevo insumo
      setName("");
      setCategory("materia_prima");
      setSelectedPresetId("kg-g");
      setPurchaseUnit("kg");
      setPurchaseQuantity(1);
      setCurrentPrice("");
      setUseUnit("g");
      setConversionFactor(1000);
      setError(null);
    }
  }, [initialSupply, isOpen]);

  if (!isOpen) return null;

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = UNIT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setPurchaseUnit(preset.purchaseUnit);
      setUseUnit(preset.useUnit);
      setConversionFactor(preset.defaultFactor);
    }
  };

  const parsedPrice = typeof currentPrice === "number" ? currentPrice : parseFloat(currentPrice) || 0;
  const unitCost = calculateUnitCost(parsedPrice, purchaseQuantity, conversionFactor);

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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto border border-[#eef2eb] animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#e5f2e6] text-[#3b7c42] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-neutral-800">
              {initialSupply ? "Editar Insumo" : "Nuevo Insumo o Packaging"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Categoría */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">Tipo de Insumo</label>
            <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setCategory("materia_prima")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                  category === "materia_prima"
                    ? "bg-white text-[#306236] shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                Materia Prima
              </button>
              <button
                type="button"
                onClick={() => setCategory("packaging")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                  category === "packaging"
                    ? "bg-white text-[#306236] shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                Packaging
              </button>
            </div>
          </div>

          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">Nombre del Insumo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={category === "packaging" ? "Ej: Caja 15x15, Sobre Kraft..." : "Ej: Harina 000, Cera de Soja, Tela..."}
              required
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none transition"
            />
          </div>

          {/* Preset de Unidades */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">¿Cómo lo compras y cómo lo usas?</label>
            <select
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none transition"
            >
              {UNIT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad y Unidad de Compra */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Cantidad Comprada</label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={purchaseQuantity}
                onChange={(e) => setPurchaseQuantity(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Unidad de Compra</label>
              <input
                type="text"
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value)}
                placeholder="kg, metro, pack..."
                required
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
              />
            </div>
          </div>

          {/* Precio de Reposición Actual */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700">
                Precio Actual de Reposición ($)
              </label>
              <span className="text-[10px] text-[#306236] bg-[#e5f2e6] px-1.5 py-0.5 rounded-md font-medium">
                Al día de hoy
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 font-semibold text-sm">
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
                className="w-full pl-8 pr-3.5 py-2.5 text-sm font-semibold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none transition"
              />
            </div>
            <p className="text-[10px] text-neutral-400">
              Lo que te cuesta reponerlo hoy en el proveedor, no lo que pagaste hace meses.
            </p>
          </div>

          {/* Unidad de Uso y Factor de Conversión */}
          <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-600">Unidad en Producto</label>
              <input
                type="text"
                value={useUnit}
                onChange={(e) => setUseUnit(e.target.value)}
                placeholder="g, cm, u..."
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-600">
                Rinde por 1 {purchaseUnit || "compra"}
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Tarjeta de Cálculo en Vivo */}
          <div className="bg-[#e5f2e6] border border-[#cce5ce] p-3.5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#306236]" />
              <div>
                <p className="text-[11px] font-semibold text-[#2a4f2f]">Costo Unitario de Uso:</p>
                <p className="text-[10px] text-[#3b7c42]">
                  1 {useUnit} = {formatCurrency(unitCost)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-[#244228]">
                {formatCurrency(unitCost)}
              </span>
              <span className="text-[10px] block text-[#306236]">por {useUnit}</span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-3 bg-[#3b7c42] hover:bg-[#326b38] text-white rounded-2xl text-xs font-bold transition shadow-sm disabled:opacity-60"
            >
              {loading ? "Guardando..." : initialSupply ? "Actualizar Insumo" : "Guardar Insumo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
