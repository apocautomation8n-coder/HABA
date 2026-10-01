"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  AlertCircle,
  Calculator,
  ChevronDown,
  Search,
  Check,
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

const getCleanUnitLabel = (preset: UnitPreset): string => {
  switch (preset.id) {
    case "kg-g":
      return "Kilogramo (kg)";
    case "g-g":
      return "Gramo (g)";
    case "g-mg":
      return "Gramo (g) → Miligramo (mg)";
    case "l-ml":
      return "Litro (l)";
    case "ml-ml":
      return "Mililitro (ml)";
    case "m-cm":
      return "Metro (m)";
    case "m-mm":
      return "Metro (m) → Milímetro (mm)";
    case "cm-cm":
      return "Centímetro (cm)";
    case "m2-cm2":
      return "Metro cuadrado (m²)";
    case "m2-m2":
      return "Metro cuadrado (m² directos)";
    case "cm2-cm2":
      return "Centímetro cuadrado (cm²)";
    case "docena-u":
      return "Docena (12 unidades)";
    case "u-u":
      return "Unidad (u)";
    case "resma-hoja":
      return "Resma";
    case "caja-u":
      return "Caja";
    case "bulto-u":
      return "Bulto";
    case "pack-u":
      return "Paquete / Pack";
    case "pliego-hoja":
      return "Pliego";
    case "custom":
      return "Personalizado (manual)";
    default:
      return preset.shortLabel || preset.name;
  }
};

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
        className="bg-white w-full max-w-md sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-[#EAF0E8] animate-in slide-in-from-bottom-6 duration-200 overflow-hidden"
        style={{
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 20px) - 20px)",
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

            {/* Tipo de Insumo */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#2B2B2B] block">
                Tipo de Insumo
              </label>
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

            {/* Nombre del Insumo */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#2B2B2B] block">
                Nombre del Insumo *
              </label>
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
                className="w-full h-9 px-3 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition text-[#2B2B2B]"
              />
            </div>

            {/* Fila Horizontal: Cantidad * y Unidad de Compra * */}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#2B2B2B] block">
                  Cantidad *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(e.target.value)}
                  placeholder="1"
                  required
                  className="w-full h-9 px-3 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B] transition"
                />
              </div>

              <div className="space-y-1 relative" ref={unitDropdownRef}>
                <label className="text-[11px] font-semibold text-[#2B2B2B] block">
                  Unidad de Compra *
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
                    className="w-full h-9 pl-3 pr-8 text-xs font-semibold bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B] transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUnitSearch("");
                      setIsUnitDropdownOpen((prev) => !prev);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isUnitDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown de Unidades Limpio */}
                  {isUnitDropdownOpen && (
                    <div className="absolute z-[120] left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-[#C3EBC0] rounded-2xl shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 overscroll-contain">
                      <div className="px-2 py-1 border-b border-neutral-100 mb-1 flex items-center gap-1.5 text-neutral-400">
                        <Search className="w-3 h-3 text-[#3BB578]" />
                        <input
                          type="text"
                          value={unitSearch}
                          onChange={(e) => setUnitSearch(e.target.value)}
                          placeholder="Buscar unidad..."
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
                              <span className="truncate">{getCleanUnitLabel(preset)}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#1F7A4C] flex-shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Precio de Reposición y Pregunta Dinámica (para Unidades Variables) */}
            <div
              className={`grid ${
                !activePreset?.isStandard ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
              } gap-3 items-start`}
            >
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#2B2B2B] block">
                  Precio de Reposición ($ ARS) *
                </label>
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
                    className="w-full h-9 pl-7 pr-3 text-xs font-semibold text-[#2B2B2B] bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                  />
                </div>
              </div>

              {/* Pregunta Dinámica: se muestra SOLO si la unidad elegida requiere definir el contenido */}
              {!activePreset?.isStandard && (
                <div className="space-y-1 animate-in fade-in duration-150">
                  <label
                    className="text-[11px] font-semibold text-[#2B2B2B] block truncate"
                    title={activePreset?.promptQuestion || `Contenido por ${purchaseUnit}`}
                  >
                    {activePreset?.promptQuestion || `Contenido por ${purchaseUnit}`} *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(e.target.value)}
                      placeholder={activePreset?.promptPlaceholder || "1"}
                      required
                      className="w-full h-9 pl-3 pr-14 text-xs font-semibold text-[#2B2B2B] bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none transition"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10.5px] text-[#7A7A7A] font-medium pointer-events-none">
                      {useUnit}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Unidad de uso manual si preset es custom */}
            {activePreset?.id === "custom" && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <label className="text-[11px] font-semibold text-[#2B2B2B] block">
                  Unidad de uso en tus productos *
                </label>
                <input
                  type="text"
                  value={useUnit}
                  onChange={(e) => setUseUnit(e.target.value)}
                  placeholder="ej: unidad, gramo, parte..."
                  required
                  className="w-full h-9 px-3 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B] transition"
                />
              </div>
            )}

            {/* Tarjeta de Costo Unitario de Uso Limpia */}
            <div className="bg-[#DCF4D7]/80 border border-[#C3EBC0] p-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#3BB578] text-white flex items-center justify-center flex-shrink-0">
                    <Calculator className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#1F7A4C]">
                    Costo unitario de uso:
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black text-[#1F7A4C] font-display">
                    {formatCurrency(unitCost)}
                  </span>
                  <span className="text-[10px] block text-[#2E9E65] font-semibold">
                    por cada {useUnit}
                  </span>
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
