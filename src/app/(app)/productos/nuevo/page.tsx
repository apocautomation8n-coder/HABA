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
  Tag,
  Info,
  X,
  Store,
  Truck,
  Users,
  Globe,
  SlidersHorizontal,
  Search,
  Edit3,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, calculateUnitCost } from "@/lib/units";
import { SupplyItem } from "@/components/SupplyModal";
import { PRODUCT_CATEGORIES, serializeProductDescription } from "@/lib/products";

interface SelectedSupply {
  supply: SupplyItem;
  quantity: number | string; // en use_unit
  waste_percent?: number | string; // % de merma / desperdicio
}

interface ChannelPrice {
  id: string;
  channel_name: string;
  profit_margin_percent: number | string;
  selling_price: number | string;
}

const DEFAULT_CHANNELS = [
  { id: "local", name: "Local / Mostrador", defaultMargin: 100 },
  { id: "delivery", name: "Delivery / Envíos", defaultMargin: 80 },
  { id: "revendedora", name: "Revendedora / Mayorista", defaultMargin: 40 },
  { id: "online", name: "Online / Tienda Web", defaultMargin: 120 },
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

  // Datos del Producto - Paso 1: Básicos y Categoría
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [step1Errors, setStep1Errors] = useState<{ name?: string; category?: string }>({});

  // Paso 2: Insumos & Packaging (Receta con merma %)
  const [selectedSupplies, setSelectedSupplies] = useState<SelectedSupply[]>([]);
  const [supplyPickerOpen, setSupplyPickerOpen] = useState(false);
  const [showWasteInfo, setShowWasteInfo] = useState(false);
  const [supplySearch, setSupplyPickerSearch] = useState("");

  // Paso 3: Tiempo / Mano de Obra (Opcional)
  const [includeLabor, setIncludeLabor] = useState(true);
  const [workTimeMinutes, setWorkTimeMinutes] = useState<number | string>(30);
  const [showTimeInfo, setShowTimeInfo] = useState(false);

  // Paso 4: Gastos Indirectos / Fijos (Opcional prorrateo sugerido)
  const [indirectCost, setIndirectCost] = useState<number | string>("");

  // Paso 5: Precios Multicanal
  const [channelPrices, setChannelPrices] = useState<ChannelPrice[]>(
    DEFAULT_CHANNELS.map((ch) => ({
      id: ch.id,
      channel_name: ch.name,
      profit_margin_percent: ch.defaultMargin,
      selling_price: 0,
    }))
  );
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelMargin, setNewChannelMargin] = useState(100);
  const [showChannelInfo, setShowChannelInfo] = useState(false);

  // Cargar insumos, mano de obra y gastos fijos
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
        console.error("Error fetching initial wizard data:", err);
      } finally {
        setLoadingSupplies(false);
      }
    };

    fetchData();
  }, [supabase]);

  // Restaurar borrador de producto si el usuario salió temporalmente de la app (Punto E)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("haba_draft_nuevo_producto");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.name) setName(draft.name);
        if (draft.category) setCategory(draft.category);
        if (draft.customCategory) setCustomCategory(draft.customCategory);
        if (draft.description) setDescription(draft.description);
        if (draft.currentStep) setCurrentStep(draft.currentStep);
        if (draft.workTimeMinutes) setWorkTimeMinutes(draft.workTimeMinutes);
        if (draft.selectedSupplies && Array.isArray(draft.selectedSupplies)) {
          setSelectedSupplies(draft.selectedSupplies);
        }
        if (draft.channelPrices && Array.isArray(draft.channelPrices)) {
          setChannelPrices(draft.channelPrices);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Guardar borrador en sessionStorage reactivamente ante cambios (Punto E)
  useEffect(() => {
    try {
      if (name || category || selectedSupplies.length > 0) {
        sessionStorage.setItem(
          "haba_draft_nuevo_producto",
          JSON.stringify({
            name,
            category,
            customCategory,
            description,
            currentStep,
            workTimeMinutes,
            selectedSupplies,
            channelPrices,
          })
        );
      }
    } catch {
      // ignore
    }
  }, [name, category, customCategory, description, currentStep, workTimeMinutes, selectedSupplies, channelPrices]);

  // Cálculos reactivos de costos:
  // 1. Costo directo de materiales (Insumos + Packaging + Merma %)
  const directCost = useMemo(() => {
    return selectedSupplies.reduce((acc, item) => {
      const unitCost = calculateUnitCost(
        item.supply.current_price,
        item.supply.purchase_quantity,
        item.supply.conversion_factor
      );
      const q = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
      const wasteFactor = 1 + (Number(item.waste_percent) || 0) / 100;
      return acc + unitCost * q * wasteFactor;
    }, 0);
  }, [selectedSupplies]);

  // 2. Costo de Mano de Obra
  const laborCost = useMemo(() => {
    if (!includeLabor) return 0;
    const mins = typeof workTimeMinutes === "number" ? workTimeMinutes : parseFloat(String(workTimeMinutes)) || 0;
    return mins * (laborMinuteRate || 0);
  }, [includeLabor, workTimeMinutes, laborMinuteRate]);

  // 3. Costo Total Unitario (Materiales + Mano de obra según tiempo y objetivo mensual)
  const totalCost = useMemo(() => {
    return directCost + laborCost;
  }, [directCost, laborCost]);

  // Actualizar precios sugeridos de canales cuando cambia el totalCost
  useEffect(() => {
    setChannelPrices((prev) =>
      prev.map((ch) => {
        const marginNum = typeof ch.profit_margin_percent === "number" ? ch.profit_margin_percent : parseFloat(String(ch.profit_margin_percent)) || 0;
        const calculatedPrice = totalCost * (1 + marginNum / 100);
        return {
          ...ch,
          selling_price: Math.round(calculatedPrice),
        };
      })
    );
  }, [totalCost]);

  // Modificar margen y recalcular precio de un canal
  const handleMarginChange = (index: number, marginVal: number | string) => {
    setChannelPrices((prev) => {
      const updated = [...prev];
      if (marginVal === "" || isNaN(Number(marginVal))) {
        updated[index] = {
          ...updated[index],
          profit_margin_percent: marginVal,
          selling_price: "",
        };
        return updated;
      }
      const marginNum = typeof marginVal === "number" ? marginVal : parseFloat(String(marginVal)) || 0;
      const newPrice = totalCost * (1 + marginNum / 100);
      updated[index] = {
        ...updated[index],
        profit_margin_percent: marginVal,
        selling_price: Math.round(newPrice),
      };
      return updated;
    });
  };

  // Modificar precio final y recalcular margen de un canal
  const handlePriceChange = (index: number, priceVal: number | string) => {
    setChannelPrices((prev) => {
      const updated = [...prev];
      if (priceVal === "" || isNaN(Number(priceVal))) {
        updated[index] = {
          ...updated[index],
          profit_margin_percent: "",
          selling_price: priceVal,
        };
        return updated;
      }
      const priceNum = typeof priceVal === "number" ? priceVal : parseFloat(String(priceVal)) || 0;
      let newMargin = 0;
      if (totalCost > 0) {
        newMargin = Math.round(((priceNum - totalCost) / totalCost) * 100);
      }
      updated[index] = {
        ...updated[index],
        profit_margin_percent: newMargin,
        selling_price: priceVal,
      };
      return updated;
    });
  };

  // Eliminar un canal de precio
  const handleRemoveChannel = (index: number) => {
    if (channelPrices.length <= 1) {
      alert("Debes mantener al menos un canal de precio para el producto.");
      return;
    }
    setChannelPrices((prev) => prev.filter((_, i) => i !== index));
  };

  // Agregar nuevo canal de precio
  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;
    const calculatedPrice = Math.round(totalCost * (1 + newChannelMargin / 100));
    setChannelPrices((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        channel_name: newChannelName.trim(),
        profit_margin_percent: newChannelMargin,
        selling_price: calculatedPrice,
      },
    ]);
    setNewChannelName("");
    setNewChannelMargin(100);
    setIsAddingChannel(false);
  };

  // Modificar nombre de un canal existente
  const handleChannelNameChange = (index: number, newName: string) => {
    setChannelPrices((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        channel_name: newName,
      };
      return updated;
    });
  };

  // Agregar insumo a la receta
  const handleAddSupply = (supply: SupplyItem) => {
    if (selectedSupplies.some((s) => s.supply.id === supply.id)) return;
    setSelectedSupplies((prev) => [...prev, { supply, quantity: 1, waste_percent: 0 }]);
    setSupplyPickerOpen(false);
  };

  // Cambiar cantidad de insumo
  const handleUpdateSupplyQty = (index: number, qty: number | string) => {
    setSelectedSupplies((prev) => {
      const updated = [...prev];
      updated[index].quantity = qty;
      return updated;
    });
  };

  // Cambiar merma % de insumo
  const handleUpdateSupplyWaste = (index: number, waste: number | string) => {
    setSelectedSupplies((prev) => {
      const updated = [...prev];
      updated[index].waste_percent = waste;
      return updated;
    });
  };

  // Quitar insumo de la receta
  const handleRemoveSupply = (index: number) => {
    setSelectedSupplies((prev) => prev.filter((_, i) => i !== index));
  };

  // Validación de Paso 1
  const validateStep1 = (): boolean => {
    const errors: { name?: string; category?: string } = {};
    if (!name.trim()) {
      errors.name = "El nombre del producto es obligatorio.";
    }
    if (!category) {
      errors.category = "Seleccioná una categoría para tu producto.";
    } else if (category === "otro" && !customCategory.trim()) {
      errors.category = "Por favor especificá el rubro artesanal de tu producto.";
    }
    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) {
      setErrorMsg(null);
      setCurrentStep(2);
    } else {
      setErrorMsg("Completá los campos obligatorios para continuar.");
    }
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 1 && !validateStep1()) {
      setErrorMsg("Completá el nombre y la categoría en el Paso 1 antes de avanzar.");
      return;
    }
    setErrorMsg(null);
    setCurrentStep(targetStep);
  };

  // Guardado Atómico en Supabase con Rollback
  const handleSaveProduct = async () => {
    setErrorMsg(null);
    if (!validateStep1()) {
      setErrorMsg("El nombre y la categoría del producto son obligatorios");
      setCurrentStep(1);
      return;
    }
    if (selectedSupplies.length === 0) {
      setErrorMsg("Debes agregar al menos un insumo o packaging al producto");
      setCurrentStep(2);
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sesión no válida");

      // Categoría y estado activo serializados
      const effectiveCategory = category === "otro" ? customCategory.trim() : category;
      const categoryLabel =
        PRODUCT_CATEGORIES.find((c) => c.id === effectiveCategory)?.label || effectiveCategory;

      const finalDescription = serializeProductDescription({
        cleanDescription: description,
        category: categoryLabel,
        isActive: true,
      });

      // 1. Insertar en tabla products
      const mins = typeof workTimeMinutes === "number" ? workTimeMinutes : parseFloat(String(workTimeMinutes)) || 0;
      const ind = typeof indirectCost === "number" ? indirectCost : parseFloat(String(indirectCost)) || 0;
      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: finalDescription || null,
          work_time_minutes: includeLabor ? mins : 0,
          include_labor: includeLabor,
          direct_cost: directCost,
          labor_cost: laborCost,
          indirect_cost: ind,
          total_cost: totalCost,
          needs_price_review: false,
        })
        .select()
        .single();

      if (productError || !productData) {
        throw new Error(productError?.message || "Error al crear el producto en la base de datos");
      }

      const productId = productData.id;

      // 2. Insertar insumos de la receta en product_supplies con ROLLBACK si falla
      const suppliesToInsert = selectedSupplies.map((s) => ({
        product_id: productId,
        supply_id: s.supply.id,
        quantity: typeof s.quantity === "number" ? s.quantity : parseFloat(String(s.quantity)) || 0,
      }));

      const { error: suppliesError } = await supabase
        .from("product_supplies")
        .insert(suppliesToInsert);

      if (suppliesError) {
        console.error("Error insertando insumos. Ejecutando rollback...", suppliesError);
        // Rollback: borrar el producto creado para evitar registros huérfanos
        await supabase.from("products").delete().eq("id", productId);
        throw new Error(`Error al guardar la receta: ${suppliesError.message}. Operación revertida.`);
      }

      // 3. Insertar precios de canales en product_prices con ROLLBACK completo si falla
      const pricesToInsert = channelPrices.map((cp) => ({
        product_id: productId,
        channel_name: cp.channel_name,
        profit_margin_percent: typeof cp.profit_margin_percent === "number" ? cp.profit_margin_percent : parseFloat(String(cp.profit_margin_percent)) || 0,
        selling_price: typeof cp.selling_price === "number" ? cp.selling_price : parseFloat(String(cp.selling_price)) || 0,
      }));

      const { error: pricesError } = await supabase
        .from("product_prices")
        .insert(pricesToInsert);

      if (pricesError) {
        console.error("Error insertando precios. Ejecutando rollback...", pricesError);
        // Rollback: borrar insumos y producto
        await supabase.from("product_supplies").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
        throw new Error(`Error al guardar los precios: ${pricesError.message}. Operación revertida.`);
      }

      // Limpiar borrador de sesión
      try {
        sessionStorage.removeItem("haba_draft_nuevo_producto");
      } catch {
        // ignore
      }

      // Redirigir con éxito
      router.push("/productos");
    } catch (err: any) {
      setErrorMsg(err.message || "Error inesperado al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  // Helper para íconos de canales
  const getChannelIcon = (id: string) => {
    switch (id) {
      case "local":
        return <Store className="w-4 h-4 text-emerald-600" />;
      case "delivery":
        return <Truck className="w-4 h-4 text-blue-600" />;
      case "revendedora":
        return <Users className="w-4 h-4 text-purple-600" />;
      case "online":
        return <Globe className="w-4 h-4 text-amber-600" />;
      default:
        return <Tag className="w-4 h-4 text-neutral-500" />;
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
            <p className="text-xs text-neutral-500">Calculadora de costo y fijación de precios en 4 pasos</p>
          </div>
        </div>
      </div>

      {/* Barra de Pasos Kawaii (4 pasos) */}
      <div className="bg-white p-2.5 rounded-3xl border border-[#EAF0E8] shadow-sm flex items-center justify-between text-xs overflow-x-auto gap-1">
        {[
          { step: 1, label: "Detalles" },
          { step: 2, label: "Insumos" },
          { step: 3, label: "Tiempo" },
          { step: 4, label: "Precios" },
        ].map((item) => (
          <button
            key={item.step}
            type="button"
            onClick={() => handleStepClick(item.step)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl font-bold transition flex-shrink-0 ${
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
            <span className="hidden xs:inline text-[11px]">{item.label}</span>
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
              Mat: {formatCurrency(directCost)} | Productivo: {formatCurrency(laborCost)}
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
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#3BB578]" />
              <div>
                <h3 className="text-sm font-bold text-neutral-800">1. Datos Básicos del Producto</h3>
                <p className="text-[11px] text-neutral-400">
                  Definí el nombre, la categoría y los detalles de tu creación
                </p>
              </div>
            </div>
          </div>

          {/* Campo: Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Nombre del Producto <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-neutral-400 font-normal">Ej: Vela de Soja Vainilla 200g</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (step1Errors.name) setStep1Errors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="¿Qué producto vas a confeccionar?"
              className={`w-full px-3.5 py-2.5 text-xs bg-neutral-50 border rounded-2xl focus:bg-white outline-none transition ${
                step1Errors.name
                  ? "border-rose-300 ring-2 ring-rose-100 bg-rose-50/20"
                  : "border-neutral-200 focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7]"
              }`}
            />
            {step1Errors.name && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{step1Errors.name}</span>
              </p>
            )}
          </div>

          {/* Campo: Categoría */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Categoría Artesanal <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-neutral-400 font-normal">Seleccioná tu rubro</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRODUCT_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      if (step1Errors.category) setStep1Errors((prev) => ({ ...prev, category: undefined }));
                    }}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition ${
                      isSelected
                        ? "border-[#3BB578] bg-[#DCF4D7]/50 shadow-xs"
                        : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100/80"
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className={`text-[11px] font-bold leading-tight ${isSelected ? "text-[#1F7A4C]" : "text-neutral-700"}`}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {category === "otro" && (
              <div className="pt-2 animate-in fade-in-50 duration-200">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => {
                    setCustomCategory(e.target.value);
                    if (step1Errors.category) {
                      setStep1Errors((prev) => ({ ...prev, category: undefined }));
                    }
                  }}
                  placeholder="Especificá tu categoría (Ej: Cosmética natural, Resina epoxi, Joyería...)"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-[#3BB578] rounded-2xl outline-none focus:ring-2 focus:ring-[#DCF4D7]"
                />
              </div>
            )}

            {step1Errors.category && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{step1Errors.category}</span>
              </p>
            )}
          </div>

          {/* Campo: Descripción o Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Descripción o Detalles</span>
              <span className="text-[10px] text-neutral-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Medidas, tipo de papel, encuadernación, aromas o notas para la producción..."
              className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none resize-none transition"
            />
          </div>

          {/* Botón de Avance */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="py-2.5 px-6 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>Siguiente: Insumos</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Insumos & Packaging del Producto (Con Merma %) */}
      {currentStep === 2 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#3BB578]" />
              <div>
                <h3 className="text-sm font-bold text-neutral-800">2. Insumos, Packaging y Merma %</h3>
                <p className="text-[11px] text-neutral-400">
                  Agregá lo que consume 1 unidad y el desperdicio estimado
                </p>
              </div>
            </div>
          </div>

          {/* Banner Didáctico Paso 2 (Minimizable - Punto G) */}
          <div className="bg-[#F0FAF4] border border-[#DCF4D7] rounded-2xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowWasteInfo(!showWasteInfo)}
              className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-[#DCF4D7]/30 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3" />
                </div>
                <span className="font-bold text-[11px] text-[#1F7A4C]">¿Cómo costear los materiales y la merma?</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#1F7A4C] font-semibold bg-white/70 px-2 py-0.5 rounded-full border border-[#DCF4D7]">
                <span>{showWasteInfo ? "Ocultar" : "Ver explicación"}</span>
                {showWasteInfo ? <ChevronRight className="w-3 h-3 rotate-90 transition-transform" /> : <ChevronRight className="w-3 h-3 transition-transform" />}
              </div>
            </button>
            {showWasteInfo && (
              <div className="px-3 pb-3 pt-0.5 text-[11px] leading-snug text-[#555] border-t border-[#DCF4D7]/60 animate-in fade-in duration-150">
                <p className="pt-2">
                  Ingresás la cantidad que lleva 1 producto terminado. Si al cortar o producir hay recortes o desperdicios que se pierden, agregá un <strong>% de Merma</strong> (ej: 5% o 10%) para que el costo real quede cubierto.
                </p>
              </div>
            )}
          </div>

          {selectedSupplies.length === 0 ? (
            <div className="space-y-3">
              <div className="bg-neutral-50 rounded-2xl p-6 border border-dashed border-neutral-200 text-center">
                <Boxes className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-neutral-600">
                  Aún no agregaste insumos ni packaging a este producto.
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Tocá el botón de abajo para sumar los materiales que utilizás para fabricarlo.
                </p>
              </div>
              <button
                onClick={() => setSupplyPickerOpen(true)}
                className="w-full py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl shadow-sm transition"
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
                const itemQty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
                const wastePercent = Number(item.waste_percent) || 0;
                const wasteMultiplier = 1 + wastePercent / 100;
                const subtotal = unitCost * itemQty * wasteMultiplier;

                return (
                  <div
                    key={item.supply.id || idx}
                    className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex flex-col space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-neutral-800">
                          {item.supply.name}
                        </span>
                        <span className="text-[10px] block text-neutral-400">
                          Costo reposición: {formatCurrency(unitCost)} / {item.supply.use_unit}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveSupply(idx)}
                        className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg transition"
                        title="Quitar de la receta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/50">
                      {/* Cantidad consumida */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-600">
                          Cantidad:
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            value={item.quantity === 0 ? "" : item.quantity}
                            onChange={(e) =>
                              handleUpdateSupplyQty(idx, e.target.value)
                            }
                            placeholder="1"
                            className="w-full px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                          />
                          <span className="text-[11px] font-semibold text-neutral-500 flex-shrink-0">
                            {item.supply.use_unit}
                          </span>
                        </div>
                      </div>

                      {/* Merma % */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-600 flex items-center justify-between">
                          <span>Merma %:</span>
                          <span className="text-[9px] text-neutral-400">(desperdicio)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            value={item.waste_percent === 0 ? "" : (item.waste_percent ?? "")}
                            onChange={(e) =>
                              handleUpdateSupplyWaste(idx, e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-full px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                          />
                          <span className="absolute right-2 top-1 text-[11px] text-neutral-400 font-bold">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/40 text-[10.5px]">
                      <span className="text-neutral-500">
                        {item.quantity} {item.supply.use_unit}
                        {wastePercent > 0 && ` (+${wastePercent}% merma)`}
                      </span>
                      <span className="font-bold text-[#1F7A4C] text-xs">
                        Subtotal: {formatCurrency(subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedSupplies.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSupplyPickerOpen(true)}
                className="py-2 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>
          )}

          {selectedSupplies.length > 0 && (
            <div className="p-3 bg-[#DCF4D7]/70 border border-[#C3EBC0] rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-[#1F7A4C]">Total Materiales (1 unidad):</span>
              <span className="text-sm font-black text-[#1F7A4C] font-display">{formatCurrency(directCost)}</span>
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
              <span>Siguiente: Tiempo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Tiempo de Producción */}
      {currentStep === 3 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Clock className="w-5 h-5 text-[#3BB578]" />
            <div>
              <h3 className="text-sm font-bold text-neutral-800">3. Tiempo de Producción</h3>
              <p className="text-[11px] text-neutral-400">
                Tu tiempo de confección calculado al minuto
              </p>
            </div>
          </div>

          {laborMinuteRate === 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-snug text-amber-800 space-y-1">
                <p>
                  <strong>⚠️ Aún no configuraste tu Objetivo Mensual</strong> en la sección Gastos & Mano de Obra. Te recomendamos hacerlo para que HABA calcule correctamente el costo de tu tiempo.
                </p>
                <Link href="/gastos" className="inline-block font-bold text-amber-700 underline mt-1">
                  Ir a Gastos
                </Link>
              </div>
            </div>
          )}

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-4">
            <div className="flex flex-col space-y-3">
              <label className="text-sm font-bold text-neutral-800 block">
                ¿Cuánto tiempo lleva realizar este producto?
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={workTimeMinutes === 0 ? "" : workTimeMinutes}
                  onChange={(e) => setWorkTimeMinutes(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                />
                <span className="text-sm text-neutral-500 font-medium">minutos</span>
                {Number(workTimeMinutes) >= 60 && (
                  <span className="text-xs text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-md font-semibold">
                    ~{(Number(workTimeMinutes) / 60).toFixed(1)} hs
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200/50">
              <div className="bg-[#DCF4D7] p-3 rounded-xl flex flex-col space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1F7A4C] font-semibold">Cálculo:</span>
                  <span className="font-mono text-[#1F7A4C]">
                    {workTimeMinutes || 0} min × {formatCurrency(laborMinuteRate)}/min
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#C3EBC0]">
                  <span className="text-[#1F7A4C] font-bold">Costo productivo:</span>
                  <span className="text-sm font-black text-[#1F7A4C]">
                    {formatCurrency(laborCost)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
                Este costo ya incluye proporcionalmente tus gastos operativos + tu sueldo pretendido, calculados a partir de tu Objetivo Mensual unificado.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTimeInfo(!showTimeInfo)}
                className="text-[10.5px] font-bold text-[#1F7A4C] hover:text-[#165837] underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showTimeInfo ? "Ocultar cómo se calcula" : "¿Cómo se calcula esto?"}</span>
              </button>
            </div>

            {showTimeInfo && (
              <div className="p-3 bg-[#F0FAF4] border border-[#C3EBC0] rounded-2xl space-y-2 text-xs text-[#2B2B2B] animate-in fade-in duration-200 shadow-xs">
                <div className="flex items-center justify-between font-bold text-[#1F7A4C] border-b border-[#DCF4D7] pb-1">
                  <span className="flex items-center gap-1.5 font-display text-[11.5px]">
                    <Calculator className="w-3.5 h-3.5 text-[#3BB578]" />
                    ¿Cómo calcula HABA el costo de tu tiempo?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTimeInfo(false)}
                    className="text-[#7A7A7A] hover:text-[#2B2B2B] text-xs font-semibold"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed">
                  <p>
                    1️⃣ <strong>Tu costo por minuto:</strong> Se calcula dividiendo tu <strong>Objetivo Mensual</strong> (Sueldo Pretendido + Gastos Operativos) entre las <strong>horas de taller</strong> que trabajás por mes:
                  </p>
                  <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                    Objetivo Mensual ÷ (Días × Horas diarias × 60) = <strong>{formatCurrency(laborMinuteRate)}/minuto</strong>
                  </div>
                  <p>
                    2️⃣ <strong>Para este producto:</strong> Multiplicamos los minutos de elaboración por tu valor por minuto:
                  </p>
                  <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                    {workTimeMinutes || 0} min × {formatCurrency(laborMinuteRate)}/min = <strong>{formatCurrency(laborCost)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen Total Unitario de Producción */}
            <div className="p-3 bg-[#DCF4D7]/70 border border-[#C3EBC0] rounded-2xl flex flex-col gap-1.5 text-xs text-[#1F7A4C]">
              <div className="flex justify-between items-center text-[11px]">
                <span>Insumos: <strong>{formatCurrency(directCost)}</strong> + Costo Productivo ({workTimeMinutes || 0} min): <strong>{formatCurrency(laborCost)}</strong></span>
              </div>
              <div className="flex justify-between items-center font-bold pt-1.5 border-t border-[#C3EBC0]">
                <span className="text-xs">Costo Total de Fabricación (1 unidad):</span>
                <span className="text-sm font-black text-[#1F7A4C] font-display">{formatCurrency(totalCost)}</span>
              </div>
            </div>
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
              <span>Siguiente: Precios</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Precios Multicanal & Margen con Sliders */}
      {currentStep === 4 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <TrendingUp className="w-5 h-5 text-[#3BB578]" />
            <div>
              <h3 className="text-sm font-bold text-neutral-800">4. Precios por Canal de Venta</h3>
              <p className="text-[11px] text-neutral-400">
                Slider de margen %, precio sugerido y ganancia neta en mano
              </p>
            </div>
          </div>

          {/* Banner Didáctico Paso 4 (Minimizable - Punto G) */}
          <div className="bg-[#F0FAF4] border border-[#DCF4D7] rounded-2xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowChannelInfo(!showChannelInfo)}
              className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-[#DCF4D7]/30 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3" />
                </div>
                <span className="font-bold text-[11px] text-[#1F7A4C]">Costo base: {formatCurrency(totalCost)}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#1F7A4C] font-semibold bg-white/70 px-2 py-0.5 rounded-full border border-[#DCF4D7]">
                <span>{showChannelInfo ? "Ocultar" : "Ver explicación"}</span>
                {showChannelInfo ? <ChevronRight className="w-3 h-3 rotate-90 transition-transform" /> : <ChevronRight className="w-3 h-3 transition-transform" />}
              </div>
            </button>
            {showChannelInfo && (
              <div className="px-3 pb-3 pt-0.5 text-[11px] leading-snug text-[#555] border-t border-[#DCF4D7]/60 animate-in fade-in duration-150">
                <p className="pt-2">
                  Ajustá el slider del margen (%) o escribí directamente el precio de venta en pesos. HABA calcula al instante el <strong>precio sugerido</strong> y tu <strong>ganancia neta limpia</strong>.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {channelPrices.map((channel, idx) => {
              const channelSellingPrice = typeof channel.selling_price === "number" ? channel.selling_price : parseFloat(String(channel.selling_price)) || 0;
              const marginNum = typeof channel.profit_margin_percent === "number" ? channel.profit_margin_percent : parseFloat(String(channel.profit_margin_percent)) || 0;
              const profitAmount = channelSellingPrice - totalCost;
              const suggestedPrice = Math.round(totalCost * (1 + marginNum / 100));

              return (
                <div
                  key={channel.id || idx}
                  className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      {getChannelIcon(channel.id)}
                      <input
                        type="text"
                        value={channel.channel_name}
                        onChange={(e) => handleChannelNameChange(idx, e.target.value)}
                        className="text-xs font-bold text-neutral-800 bg-transparent border-b border-dashed border-neutral-300 hover:border-[#3BB578] focus:border-[#3BB578] focus:bg-white px-1 py-0.5 rounded outline-none transition w-full max-w-[200px]"
                        title="Hacé clic para editar el nombre del canal"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          profitAmount >= 0
                            ? "bg-[#DCF4D7] text-[#1F7A4C]"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {profitAmount >= 0 ? `Ganás ${formatCurrency(profitAmount)}` : `Pérdida ${formatCurrency(profitAmount)}`}
                      </span>
                      {channelPrices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChannel(idx)}
                          className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar este tipo de precio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Slider de Margen % */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600">
                      <span className="flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3 text-neutral-400" />
                        Margen de Ganancia:
                      </span>
                      <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-neutral-200">
                        <input
                          type="number"
                          step="5"
                          min="0"
                          max="500"
                          value={channel.profit_margin_percent === 0 ? "" : channel.profit_margin_percent}
                          onChange={(e) =>
                            handleMarginChange(idx, e.target.value)
                          }
                          placeholder="0"
                          className="w-12 text-center text-xs font-bold outline-none text-[#1F7A4C]"
                        />
                        <span className="text-xs font-bold text-neutral-400">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="5"
                      value={channel.profit_margin_percent}
                      onChange={(e) =>
                        handleMarginChange(idx, parseFloat(e.target.value) || 0)
                      }
                      className="w-full accent-[#3BB578] cursor-pointer"
                    />
                  </div>

                  {/* Grid: Precio Sugerido y Precio de Lista Editable */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/50">
                    <div className="bg-white p-2 rounded-xl border border-neutral-200 text-center">
                      <span className="text-[10px] text-neutral-400 font-semibold block">
                        Precio Sugerido
                      </span>
                      <span className="text-xs font-bold text-neutral-700">
                        {formatCurrency(suggestedPrice)}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-[#3BB578] text-center">
                      <span className="text-[10px] text-[#1F7A4C] font-bold block">
                        Precio de Lista ($)
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={channel.selling_price === 0 ? "" : channel.selling_price}
                        onChange={(e) =>
                          handlePriceChange(idx, e.target.value)
                        }
                        placeholder="0.00"
                        className="w-full text-center text-xs font-black text-[#1F7A4C] outline-none"
                      />
                    </div>
                  </div>

                  {/* Desglose de Costo + Ganancia = Precio */}
                  <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[10px] text-neutral-600 bg-white/80 px-2 py-1 rounded-xl font-medium">
                    <span>Costo: <strong>{formatCurrency(totalCost)}</strong></span>
                    <span>+</span>
                    <span>Ganancia: <strong className={profitAmount >= 0 ? "text-[#1F7A4C]" : "text-rose-600"}>{formatCurrency(profitAmount)}</strong></span>
                    <span>=</span>
                    <span>Precio: <strong className="text-[#2B2B2B]">{formatCurrency(channelSellingPrice)}</strong></span>
                  </div>
                </div>
              );
            })}

            {/* Formulario / Botón para agregar nuevo tipo de precio */}
            {isAddingChannel ? (
              <div className="p-3.5 bg-neutral-50 rounded-2xl border-2 border-dashed border-[#3BB578] space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F7A4C] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Nuevo Tipo de Precio
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingChannel(false);
                      setNewChannelName("");
                    }}
                    className="text-neutral-400 hover:text-neutral-600 text-xs"
                  >
                    ✕ Cancelar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-600 block mb-1">
                      Nombre del canal / lista:
                    </label>
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="Ej: Promo X, Precio Feria, Black Friday..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-600 block mb-1">
                      Margen inicial (%):
                    </label>
                    <input
                      type="number"
                      value={newChannelMargin}
                      onChange={(e) => setNewChannelMargin(parseFloat(e.target.value) || 0)}
                      placeholder="100"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingChannel(false);
                      setNewChannelName("");
                    }}
                    className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddChannel}
                    disabled={!newChannelName.trim()}
                    className="py-1.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Precio</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingChannel(true)}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#DCF4D7]/40 text-[#1F7A4C] border-2 border-dashed border-[#3BB578]/50 hover:border-[#3BB578] rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar otro tipo de precio (Promo, Feria, etc.)</span>
              </button>
            )}
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
              className="py-3 px-6 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-60 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
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
                onClick={() => {
                  setSupplyPickerOpen(false);
                  setSupplyPickerSearch("");
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* Barra de Búsqueda con Texto Predictivo / Sugerencia en Gris */}
            <div className="pt-3 pb-1 flex-shrink-0">
              {(() => {
                // Encontrar la mejor coincidencia que comience con lo que el usuario va escribiendo
                const trimmedQuery = supplySearch.trim().toLowerCase();
                const matchedSuggestion = trimmedQuery
                  ? availableSupplies.find((s) => s.name.toLowerCase().startsWith(trimmedQuery))
                  : null;
                const suggestionSuffix = matchedSuggestion && supplySearch
                  ? matchedSuggestion.name.slice(supplySearch.length)
                  : "";

                return (
                  <div className="relative flex items-center">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <Search className="w-4 h-4" />
                    </div>

                    {/* Capa de texto predictivo sugerido en gris de fondo */}
                    {suggestionSuffix && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 pl-9 pr-8 py-2 text-xs flex items-center pointer-events-none select-none font-medium text-neutral-300 overflow-hidden"
                      >
                        <span className="opacity-0">{supplySearch}</span>
                        <span className="text-neutral-400 bg-neutral-100/80 px-0.5 rounded">{suggestionSuffix}</span>
                        <span className="text-[10px] text-neutral-400 ml-1.5 bg-neutral-200/70 px-1 py-0.2 rounded-md font-normal">
                          Tab ⇥
                        </span>
                      </div>
                    )}

                    <input
                      type="text"
                      value={supplySearch}
                      onChange={(e) => setSupplyPickerSearch(e.target.value)}
                      onKeyDown={(e) => {
                        // Presionar Tab o Flecha Derecha autocompleta con la sugerencia
                        if ((e.key === "Tab" || e.key === "ArrowRight") && matchedSuggestion && suggestionSuffix) {
                          e.preventDefault();
                          setSupplyPickerSearch(matchedSuggestion.name);
                        } else if (e.key === "Enter" && matchedSuggestion && !selectedSupplies.some((s) => s.supply.id === matchedSuggestion.id)) {
                          e.preventDefault();
                          handleAddSupply(matchedSuggestion);
                          setSupplyPickerSearch("");
                        }
                      }}
                      placeholder="Buscar insumo (ej: harina, caja, tela...)"
                      className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-50/80 focus:bg-white border border-neutral-200 rounded-2xl focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition text-neutral-800"
                      autoFocus
                    />

                    {supplySearch && (
                      <button
                        type="button"
                        onClick={() => setSupplyPickerSearch("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 my-3 space-y-2 pr-1 overscroll-contain">
              {(() => {
                const filtered = availableSupplies.filter((sup) => {
                  if (!supplySearch.trim()) return true;
                  const query = supplySearch.toLowerCase();
                  return (
                    sup.name.toLowerCase().includes(query) ||
                    (sup.category && sup.category.toLowerCase().includes(query))
                  );
                });

                if (availableSupplies.length === 0) {
                  return (
                    <div className="p-4 text-center text-xs text-neutral-500">
                      No tenés insumos cargados. Creá uno en el módulo Insumos primero.
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-neutral-400">
                      No encontramos insumos que coincidan con &ldquo;<strong>{supplySearch}</strong>&rdquo;.
                    </div>
                  );
                }

                return filtered.map((sup) => {
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
                });
              })()}
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
