"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  AlertCircle,
  Calculator,
  ChevronDown,
  CheckCircle2,
  Package,
  Search,
  Check,
  Boxes,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  UNIT_PRESETS,
  UnitPreset,
  calculateUnitCost,
  formatCurrency,
  findMatchingPreset,
  normalizeUnit,
} from "@/lib/units";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";
import { formDraftStorage } from "@/lib/formStorage";

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
  onSuccess: (newSupply?: SupplyItem) => void;
  initialSupply?: SupplyItem | Partial<SupplyItem> | null;
  zIndex?: string;
}

const QUICK_CHIPS = [
  { label: "kg", id: "kg-g" },
  { label: "g", id: "g-g" },
  { label: "resma", id: "resma-hoja" },
  { label: "caja", id: "caja-u" },
  { label: "bulto", id: "bulto-u" },
  { label: "paquete", id: "pack-u" },
  { label: "docena", id: "docena-u" },
  { label: "litro", id: "l-ml" },
  { label: "metro", id: "m-cm" },
  { label: "m²", id: "m2-cm2" },
  { label: "u", id: "u-u" },
];

export const SupplyModal: React.FC<SupplyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSupply,
  zIndex = "z-[99999]",
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

  // Combobox desplegable con búsqueda y autocompletado predictivo para Unidad de Compra
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
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

  // Cargar insumo inicial o restaurar borrador no guardado
  useEffect(() => {
    if (initialSupply) {
      setName(initialSupply.name || "");
      setCategory(initialSupply.category === "packaging" ? "packaging" : "materia_prima");
      setPurchaseUnit(initialSupply.purchase_unit || "kg");
      setPurchaseQuantity(initialSupply.purchase_quantity ?? "");
      setCurrentPrice(initialSupply.current_price ?? "");
      setUseUnit(initialSupply.use_unit || "g");
      setConversionFactor(initialSupply.conversion_factor ?? 1000);

      const matched = findMatchingPreset(initialSupply.purchase_unit, initialSupply.use_unit);
      if (matched) {
        setSelectedPresetId(matched.id);
        if (matched.isStandard) {
          setConversionFactor(matched.defaultFactor);
        }
      } else {
        setSelectedPresetId("custom");
      }
    } else {
      let restored = false;
      try {
        const draft = formDraftStorage.get<any>("haba_draft_supply_modal");
        if (draft) {
          if (draft.name || draft.currentPrice) {
            setName(draft.name || "");
            setCategory(draft.category || "materia_prima");
            setPurchaseUnit(draft.purchaseUnit || "kg");
            setPurchaseQuantity(draft.purchaseQuantity ?? "");
            setCurrentPrice(draft.currentPrice ?? "");
            setUseUnit(draft.useUnit || "g");
            setConversionFactor(draft.conversionFactor ?? 1000);
            setSelectedPresetId(draft.selectedPresetId || "kg-g");
            restored = true;
          }
        }
      } catch {
        // ignore
      }

      if (!restored) {
        setName("");
        setCategory("materia_prima");
        setPurchaseUnit("kg");
        setPurchaseQuantity("");
        setCurrentPrice("");
        setUseUnit("g");
        setConversionFactor(1000);
        setSelectedPresetId("kg-g");
      }
      setError(null);
    }
  }, [initialSupply, isOpen]);

  // Persistir en almacenamiento local mientras el usuario escribe
  useEffect(() => {
    if (!isOpen || initialSupply) return;
    try {
      if (name.trim() || currentPrice) {
        formDraftStorage.set("haba_draft_supply_modal", {
          name,
          category,
          purchaseUnit,
          purchaseQuantity,
          currentPrice,
          useUnit,
          conversionFactor,
          selectedPresetId,
        });
      }
    } catch {
      // ignore
    }
  }, [isOpen, initialSupply, name, category, purchaseUnit, purchaseQuantity, currentPrice, useUnit, conversionFactor, selectedPresetId]);

  // Preset activo actual
  const activePreset: UnitPreset | undefined = useMemo(() => {
    const byId = UNIT_PRESETS.find((p) => p.id === selectedPresetId);
    if (byId && byId.id !== "custom") return byId;
    const byMatch = findMatchingPreset(purchaseUnit, useUnit);
    if (byMatch) return byMatch;
    return UNIT_PRESETS.find((p) => p.id === "custom");
  }, [selectedPresetId, purchaseUnit, useUnit]);

  // Opciones filtradas en el desplegable según búsqueda predictiva
  const filteredPresets = useMemo(() => {
    if (!unitSearch.trim()) return UNIT_PRESETS;
    const q = normalizeUnit(unitSearch);
    return UNIT_PRESETS.filter((p) => {
      if (normalizeUnit(p.name).includes(q)) return true;
      if (normalizeUnit(p.shortLabel).includes(q)) return true;
      if (normalizeUnit(p.purchaseUnit).includes(q)) return true;
      if (normalizeUnit(p.useUnit).includes(q)) return true;
      return p.keywords.some((kw) => normalizeUnit(kw).includes(q));
    });
  }, [unitSearch]);

  const handleSelectPreset = (preset: UnitPreset) => {
    setSelectedPresetId(preset.id);
    setPurchaseUnit(preset.purchaseUnit);
    setUseUnit(preset.useUnit);
    setConversionFactor(preset.defaultFactor);
    setIsUnitDropdownOpen(false);
    setUnitSearch("");
  };

  const handlePurchaseUnitInput = (val: string) => {
    setPurchaseUnit(val);
    setUnitSearch(val);
    setIsUnitDropdownOpen(true);

    const matched = findMatchingPreset(val);
    if (matched) {
      setSelectedPresetId(matched.id);
      setUseUnit(matched.useUnit);
      if (matched.isStandard) {
        setConversionFactor(matched.defaultFactor);
      }
    } else {
      setSelectedPresetId("custom");
    }
  };

  if (!isOpen || !mounted) return null;

  const parsedPrice = typeof currentPrice === "number" ? currentPrice : parseFloat(currentPrice) || 0;
  const parsedQuantity = typeof purchaseQuantity === "number" ? purchaseQuantity : parseFloat(String(purchaseQuantity)) || 0;
  const parsedConversion = activePreset?.isStandard
    ? activePreset.defaultFactor
    : typeof conversionFactor === "number"
    ? conversionFactor
    : parseFloat(String(conversionFactor)) || 0;

  const unitCost = calculateUnitCost(parsedPrice, parsedQuantity, parsedConversion);
  const totalRecipeUnits = parsedQuantity * parsedConversion;

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
      setError(
        activePreset?.promptQuestion
          ? `Por favor completá: ${activePreset.promptQuestion}`
          : "El factor de rendimiento debe ser mayor a 0"
      );
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

        if (priceChanged) {
          const { data: existingHistory } = await supabase
            .from("supply_price_history")
            .select("id")
            .eq("supply_id", initialSupply.id)
            .limit(1);

          if (!existingHistory || existingHistory.length === 0) {
            if (initialSupply.current_price && initialSupply.current_price > 0) {
              await supabase.from("supply_price_history").insert({
                supply_id: initialSupply.id,
                price: initialSupply.current_price,
                changed_at: initialSupply.updated_at || initialSupply.created_at || nowIso,
              });
            }
          }

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
          .select("*")
          .single();

        if (insertError) throw insertError;

        if (newSupply?.id) {
          await supabase.from("supply_price_history").insert({
            supply_id: newSupply.id,
            price: parsedPrice,
            changed_at: nowIso,
          });
        }

        formDraftStorage.remove("haba_draft_supply_modal");

        onSuccess(newSupply as SupplyItem);
        onClose();
        return;
      }

      onSuccess(initialSupply as SupplyItem);
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
      className={`fixed inset-0 ${zIndex} bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        minHeight: "100vh",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white w-full max-w-md md:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-[#EAF0E8] animate-in slide-in-from-bottom-6 duration-200 overflow-hidden"
        style={{
          height: "min(92vh, 740px)",
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 20px) - 10px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="p-3.5 sm:p-4 border-b border-[#EAF0E8] flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center">
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
          <div className="overflow-y-auto px-4 py-3.5 space-y-3.5 flex-1 min-h-0 overscroll-contain">
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Cuadrícula de 2 columnas en Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Columna Izquierda: Datos del Insumo y Compra */}
              <div className="space-y-3.5">
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
                    placeholder={
                      category === "packaging"
                        ? "Ej: Caja 15x15, Sobre Kraft, Bolsa..."
                        : "Ej: Cera de Soja, Harina, Resina, Tela..."
                    }
                    required
                    className="w-full px-3 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition text-[#2B2B2B]"
                  />
                </div>

                {/* Cantidad y Unidad de Compra (Desplegable con búsqueda y autocompletado) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#2B2B2B]">Cantidad *</label>
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

                  <div className="space-y-1" ref={unitDropdownRef}>
                    <label className="text-[11px] font-semibold text-[#2B2B2B] flex items-center justify-between">
                      <span>Unidad de Compra *</span>
                      <span className="text-[9.5px] text-[#3BB578] font-bold">Buscar</span>
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        value={purchaseUnit}
                        onChange={(e) => handlePurchaseUnitInput(e.target.value)}
                        onFocus={() => {
                          setUnitSearch(purchaseUnit);
                          setIsUnitDropdownOpen(true);
                        }}
                        placeholder="kg, resma, caja, metro..."
                        required
                        autoComplete="off"
                        className="w-full pl-3 pr-7 py-2 text-xs font-semibold bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B] transition"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUnitSearch("");
                          setIsUnitDropdownOpen((prev) => !prev);
                        }}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isUnitDropdownOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {/* Dropdown con Autocompletado Predictivo */}
                      {isUnitDropdownOpen && (
                        <div className="absolute z-[120] left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-[#C3EBC0] rounded-2xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 overscroll-contain">
                          {/* Barra de filtro rápido dentro del dropdown */}
                          <div className="px-2 py-1 border-b border-neutral-100 mb-1 flex items-center gap-1.5 text-neutral-400">
                            <Search className="w-3 h-3 text-[#3BB578]" />
                            <input
                              type="text"
                              value={unitSearch}
                              onChange={(e) => setUnitSearch(e.target.value)}
                              placeholder="Escribí o filtrá unidad..."
                              className="w-full text-[11px] bg-transparent outline-none text-[#2B2B2B] placeholder:text-neutral-400"
                              autoFocus
                            />
                            {unitSearch && (
                              <button
                                type="button"
                                onClick={() => setUnitSearch("")}
                                className="text-neutral-400 hover:text-neutral-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {filteredPresets.length === 0 ? (
                            <div className="p-2 text-center text-xs text-neutral-500">
                              <p className="font-semibold">Sin coincidencias exactas</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPresetId("custom");
                                  setPurchaseUnit(unitSearch || purchaseUnit);
                                  setUseUnit("unidad");
                                  setConversionFactor(1);
                                  setIsUnitDropdownOpen(false);
                                }}
                                className="mt-1.5 text-[11px] text-[#1F7A4C] font-bold underline hover:text-[#165837] block w-full"
                              >
                                Usar &quot;{unitSearch || purchaseUnit}&quot; como unidad manual
                              </button>
                            </div>
                          ) : (
                            filteredPresets.map((preset) => {
                              const isSelected = selectedPresetId === preset.id;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => handleSelectPreset(preset)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center justify-between text-xs ${
                                    isSelected
                                      ? "bg-[#DCF4D7] text-[#1F7A4C] font-bold"
                                      : "hover:bg-[#F6F7F2] text-[#2B2B2B]"
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate">{preset.name}</span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400 block truncate">
                                      {preset.example}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9.5px] px-1.5 py-0.5 rounded-md flex-shrink-0 font-semibold ${
                                      preset.isStandard
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {preset.isStandard ? "Estándar" : "Pregunta cantidad"}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Atajos Rápidos de Unidades Frecuentes */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#7A7A7A] font-medium block">Atajos frecuentes:</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {QUICK_CHIPS.map((chip) => {
                      const isSelected = selectedPresetId === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            const p = UNIT_PRESETS.find((item) => item.id === chip.id);
                            if (p) handleSelectPreset(p);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10.5px] font-semibold border transition-all ${
                            isSelected
                              ? "bg-[#3BB578] text-white border-[#3BB578] shadow-xs"
                              : "bg-white text-[#555] border-[#EAF0E8] hover:bg-[#F0FAF4] hover:text-[#1F7A4C]"
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
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
                    ¿Cuánto pagarías hoy por volver a comprarlo? Mantener este precio al día protege tus ganancias.
                  </p>
                </div>
              </div>

              {/* Columna Derecha: Sistema Inteligente de Rendimiento y Tarjeta en Vivo */}
              <div className="space-y-3.5">
                {/* 1. SECCIÓN CONDICIONAL: UNIDAD ESTÁNDAR vs PREGUNTA DINÁMICA */}
                {activePreset?.isStandard ? (
                  /* UNIDADES ESTÁNDAR: Peso (kg, g), Volumen (l, ml), Longitud (m, cm), Superficie (m², cm²), Docena (12) */
                  <div className="bg-[#F0FAF4] border border-[#DCF4D7] p-3.5 rounded-2xl space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F7A4C]">
                        <CheckCircle2 className="w-4 h-4 text-[#3BB578]" />
                        <span>Cálculo automático de costo</span>
                      </div>
                      <span className="text-[10px] bg-white text-[#1F7A4C] font-semibold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                        Estándar
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-[#DCF4D7] flex items-center justify-between text-xs text-[#2B2B2B]">
                      <span>Conversión fija:</span>
                      <strong className="text-[#1F7A4C]">
                        1 {purchaseUnit} = {parsedConversion.toLocaleString("es-AR")} {useUnit}
                      </strong>
                    </div>

                    <p className="text-[10.5px] text-[#555] leading-relaxed">
                      {activePreset.category === "peso"
                        ? "Para unidades de peso (kg, g), HABA calcula automáticamente el precio por gramo. No necesitás ingresar datos de rendimiento."
                        : activePreset.category === "volumen"
                        ? "Para unidades de volumen (l, ml), HABA calcula automáticamente el precio por mililitro."
                        : activePreset.category === "longitud"
                        ? "Para unidades de longitud (m, cm), HABA calcula automáticamente el precio por centímetro o milímetro."
                        : activePreset.category === "superficie"
                        ? "Para unidades de superficie (m², cm²), HABA calcula automáticamente el precio por cm²."
                        : "Esta unidad tiene un valor fijo por definición (ej. 1 docena = 12 unidades). No requiere ingresar rendimiento."}
                    </p>
                  </div>
                ) : (
                  /* UNIDADES CON PREGUNTA DINÁMICA CONDICIONAL: Resma, Caja, Bulto, Paquete/Pack, Pliego, Manual */
                  <div className="bg-[#FFFDF5] border border-[#FDE68A] p-3.5 rounded-2xl space-y-2.5 animate-in fade-in duration-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#92400E] flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-[#D97706]" />
                        <span>
                          {activePreset?.promptQuestion || `¿Cuántas unidades contiene 1 ${purchaseUnit}?`} *
                        </span>
                      </label>
                      <span className="text-[10px] bg-amber-100 text-[#92400E] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                        Rendimiento
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={conversionFactor}
                        onChange={(e) => setConversionFactor(e.target.value)}
                        placeholder={activePreset?.promptPlaceholder || "1"}
                        required
                        className="w-full pl-3 pr-24 py-2 text-sm font-bold bg-white border border-[#FDE68A] rounded-xl focus:border-[#D97706] outline-none text-[#2B2B2B]"
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-xs text-[#92400E] font-medium pointer-events-none">
                        {useUnit} por {purchaseUnit}
                      </span>
                    </div>

                    <p className="text-[10.5px] text-[#78350F] leading-tight">
                      {purchaseUnit.toLowerCase() === "resma"
                        ? "💡 Ingresá cuántas hojas contiene la resma para costear cada hoja de papel que usás en tus productos."
                        : purchaseUnit.toLowerCase() === "caja"
                        ? "💡 Ingresá cuántas unidades vienen en la caja para costear el valor exacto por unidad."
                        : purchaseUnit.toLowerCase() === "bulto"
                        ? "💡 Ingresá cuántas unidades vienen en el bulto mayorista."
                        : purchaseUnit.toLowerCase() === "paquete" || purchaseUnit.toLowerCase() === "pack"
                        ? "💡 Ingresá cuántas unidades contiene el paquete para calcular el costo por unidad."
                        : purchaseUnit.toLowerCase() === "pliego"
                        ? "💡 Ingresá cuántas hojas o partes rinde el pliego."
                        : `Total disponible en esta compra: ${totalRecipeUnits.toLocaleString("es-AR")} ${useUnit}.`}
                    </p>

                    {activePreset?.id === "custom" && (
                      <div className="pt-2 border-t border-amber-200/60 space-y-1">
                        <label className="text-[10.5px] font-semibold text-[#7A7A7A]">
                          Unidad de uso en tus productos *
                        </label>
                        <input
                          type="text"
                          value={useUnit}
                          onChange={(e) => setUseUnit(e.target.value)}
                          placeholder="ej: unidad, parte, tiro..."
                          required
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl outline-none text-[#2B2B2B]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. TARJETA DE CÁLCULO EN VIVO */}
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
                      <span>Fórmula:</span>
                      <span>
                        {formatCurrency(parsedPrice)} ÷ {totalRecipeUnits.toLocaleString("es-AR")} {useUnit} ={" "}
                        <strong>{formatCurrency(unitCost)}/{useUnit}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Fijo con botones */}
          <div
            className="p-3.5 border-t border-neutral-100 bg-white flex gap-2 flex-shrink-0 rounded-b-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.05)]"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom, 16px), 20px)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-[#7A7A7A] rounded-2xl text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition shadow-sm disabled:opacity-60 cursor-pointer"
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
