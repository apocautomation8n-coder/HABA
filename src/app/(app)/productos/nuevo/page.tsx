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
  Pencil,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, calculateUnitCost } from "@/lib/units";
import { SupplyModal, SupplyItem } from "@/components/SupplyModal";
import { CategorySelector } from "@/components/CategorySelector";
import {
  PRODUCT_CATEGORIES,
  serializeProductDescription,
  SelectedProductComponent,
  calculateComponentsCost,
  getCategoryBadge,
  validateProductYield,
  isDuplicateProductName,
  checkProductNameExists,
} from "@/lib/products";
import { matchesSearch } from "@/lib/search";
import { formDraftStorage } from "@/lib/formStorage";

interface SelectedSupply {
  supply: SupplyItem;
  quantity: number | string; // en use_unit
}

import {
  ProductPricingChannels,
  ChannelPriceItem,
  DEFAULT_CHANNELS,
} from "@/components/products/ProductPricingChannels";
import { ProductYieldCard } from "@/components/products/ProductYieldCard";

type ChannelPrice = ChannelPriceItem;

export default function NuevoProductoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Insumos disponibles en DB
  const [availableSupplies, setAvailableSupplies] = useState<SupplyItem[]>([]);
  const [loadingSupplies, setLoadingSupplies] = useState(true);

  // Configuración de Mano de Obra del usuario
  const [laborMinuteRate, setLaborMinuteRate] = useState<number>(0);

  // Datos del Producto - Paso 1: Datos Básicos
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Papelería & Libretas");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [step1Errors, setStep1Errors] = useState<{ name?: string; category?: string }>({});

  // Paso 2: Insumos & Packaging
  const [selectedSupplies, setSelectedSupplies] = useState<SelectedSupply[]>([]);
  const [supplyPickerOpen, setSupplyPickerOpen] = useState(false);
  const [supplySearch, setSupplyPickerSearch] = useState("");
  const [isCreateSupplyOpen, setIsCreateSupplyOpen] = useState(false);
  const [newSupplyInitialName, setNewSupplyInitialName] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Rendimiento de la receta / lote (Batch size)
  const [yieldValue, setYieldValue] = useState<number | string>(1);

  // Paso 2: Subproductos / Componentes de otros productos
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Detección reactiva de nombre duplicado
  const isDuplicateName = useMemo(() => {
    return isDuplicateProductName(name, availableProducts);
  }, [name, availableProducts]);
  const [selectedComponents, setSelectedComponents] = useState<SelectedProductComponent[]>([]);
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");
  const [activeRecipeTab, setActiveRecipeTab] = useState<"supplies" | "components">("supplies");

  // Limpiar inputs de búsqueda al cerrar los modales de selección
  useEffect(() => {
    if (!supplyPickerOpen) setSupplyPickerSearch("");
  }, [supplyPickerOpen]);

  useEffect(() => {
    if (!componentPickerOpen) setComponentSearch("");
  }, [componentPickerOpen]);

  // Paso 3: Tiempo / Mano de Obra (Opcional - Inicia estrictamente en 0)
  const [includeLabor, setIncludeLabor] = useState(true);
  const [workTimeMinutes, setWorkTimeMinutes] = useState<number | string>("");
  const [showTimeInfo, setShowTimeInfo] = useState(false);

  // Paso 4: Gastos Indirectos / Fijos (Opcional prorrateo sugerido)
  const [indirectCost, setIndirectCost] = useState<number | string>("");

  // Paso 4: Precios Multicanal
  const [channelPrices, setChannelPrices] = useState<ChannelPrice[]>(DEFAULT_CHANNELS);

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

          // Cargar productos existentes para permitir usarlos como subproductos
          const { data: prodsData } = await supabase
            .from("products")
            .select("id, name, description, direct_cost, total_cost")
            .order("name", { ascending: true });

          if (prodsData) {
            setAvailableProducts(prodsData);
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

  // Restaurar borrador de producto si el usuario salió de la app o cerró la pestaña
  useEffect(() => {
    try {
      const draft = formDraftStorage.get<any>("haba_draft_nuevo_producto");
      if (draft) {
        let restored = false;
        if (draft.name) { setName(draft.name); restored = true; }
        if (draft.category) setCategory(draft.category);
        if (draft.customCategory) setCustomCategory(draft.customCategory);
        if (draft.description) setDescription(draft.description);
        if (draft.currentStep) setCurrentStep(draft.currentStep);
        if (draft.workTimeMinutes) setWorkTimeMinutes(draft.workTimeMinutes);
        if (draft.yieldValue !== undefined) setYieldValue(draft.yieldValue);
        if (draft.includeLabor !== undefined) setIncludeLabor(draft.includeLabor);
        if (draft.indirectCost !== undefined) setIndirectCost(draft.indirectCost);
        if (draft.selectedSupplies && Array.isArray(draft.selectedSupplies) && draft.selectedSupplies.length > 0) {
          setSelectedSupplies(draft.selectedSupplies);
          restored = true;
        }
        if (draft.selectedComponents && Array.isArray(draft.selectedComponents) && draft.selectedComponents.length > 0) {
          setSelectedComponents(draft.selectedComponents);
          restored = true;
        }
        if (draft.channelPrices && Array.isArray(draft.channelPrices)) {
          setChannelPrices(draft.channelPrices);
        }
        if (restored) {
          setHasRestoredDraft(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Guardar borrador en almacenamiento local reactivamente ante cambios
  useEffect(() => {
    try {
      const hasContent = Boolean(
        name.trim() ||
        description.trim() ||
        selectedSupplies.length > 0 ||
        selectedComponents.length > 0 ||
        (workTimeMinutes && Number(workTimeMinutes) > 0)
      );

      if (hasContent) {
        formDraftStorage.set("haba_draft_nuevo_producto", {
          name,
          category,
          customCategory,
          description,
          currentStep,
          workTimeMinutes,
          yieldValue,
          includeLabor,
          indirectCost,
          selectedSupplies,
          selectedComponents,
          channelPrices,
        });
      }
    } catch {
      // ignore
    }
  }, [
    name,
    category,
    customCategory,
    description,
    currentStep,
    workTimeMinutes,
    yieldValue,
    includeLabor,
    indirectCost,
    selectedSupplies,
    selectedComponents,
    channelPrices,
  ]);

  const handleDiscardDraft = () => {
    formDraftStorage.remove("haba_draft_nuevo_producto");
    setName("");
    setCategory("Papelería & Libretas");
    setCustomCategory("");
    setDescription("");
    setCurrentStep(1);
    setWorkTimeMinutes("");
    setYieldValue(1);
    setSelectedSupplies([]);
    setSelectedComponents([]);
    setChannelPrices(DEFAULT_CHANNELS);
    setHasRestoredDraft(false);
  };

  // Cálculos reactivos de costos por Lote (Batch) y Unitarios:
  // 1. Costo directo de insumos del lote (Insumos + Packaging)
  const batchSuppliesCost = useMemo(() => {
    return selectedSupplies.reduce((acc, item) => {
      const unitCost = calculateUnitCost(
        item.supply.current_price,
        item.supply.purchase_quantity,
        item.supply.conversion_factor
      );
      const q = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
      return acc + unitCost * q;
    }, 0);
  }, [selectedSupplies]);

  // 1.b. Costo base aportado por Subproductos / Componentes del lote
  const batchComponentsCost = useMemo(() => {
    return calculateComponentsCost(selectedComponents);
  }, [selectedComponents]);

  // Costo directo total del lote (Insumos + Subproductos)
  const batchDirectCost = useMemo(() => {
    return batchSuppliesCost + batchComponentsCost;
  }, [batchSuppliesCost, batchComponentsCost]);

  // 2. Costo de Mano de Obra del lote (estrictamente 0 si no se ingresan minutos)
  const batchLaborCost = useMemo(() => {
    if (!includeLabor) return 0;
    const mins = typeof workTimeMinutes === "number" ? workTimeMinutes : parseFloat(String(workTimeMinutes)) || 0;
    return mins > 0 ? mins * (laborMinuteRate || 0) : 0;
  }, [includeLabor, workTimeMinutes, laborMinuteRate]);

  // Costo Total del Lote
  const batchTotalCost = useMemo(() => {
    return batchDirectCost + batchLaborCost;
  }, [batchDirectCost, batchLaborCost]);

  // Rendimiento seguro (mínimo 1)
  const safeYield = useMemo(() => {
    const y = typeof yieldValue === "number" ? yieldValue : parseFloat(String(yieldValue)) || 1;
    return y > 0 ? y : 1;
  }, [yieldValue]);

  // Costos Unitarios Resultantes (por producto individual)
  const unitDirectCost = useMemo(() => {
    return batchDirectCost / safeYield;
  }, [batchDirectCost, safeYield]);

  const unitLaborCost = useMemo(() => {
    return batchLaborCost / safeYield;
  }, [batchLaborCost, safeYield]);

  const unitTotalCost = useMemo(() => {
    return batchTotalCost / safeYield;
  }, [batchTotalCost, safeYield]);

  // Aliases para compatibilidad con canales de venta y guardado
  const totalCost = unitTotalCost;
  const directCost = unitDirectCost;
  const laborCost = unitLaborCost;
  const suppliesCost = batchSuppliesCost;
  const componentsCost = batchComponentsCost;


  // Agregar insumo a la receta
  const handleAddSupply = (supply: SupplyItem) => {
    if (selectedSupplies.some((s) => s.supply.id === supply.id)) return;
    setSelectedSupplies((prev) => [...prev, { supply, quantity: 1 }]);
    setSupplyPickerOpen(false);
  };

  // Crear insumo al vuelo desde el selector
  const handleSupplyCreatedInline = (createdSupply?: SupplyItem) => {
    setIsCreateSupplyOpen(false);
    if (createdSupply) {
      setAvailableSupplies((prev) => {
        if (prev.some((s) => s.id === createdSupply.id)) return prev;
        return [createdSupply, ...prev].sort((a, b) => a.name.localeCompare(b.name));
      });
      handleAddSupply(createdSupply);
      setSuccessToast(`¡Insumo "${createdSupply.name}" creado y agregado a la receta!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  // Cambiar cantidad de insumo
  const handleUpdateSupplyQty = (index: number, qty: number | string) => {
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

  // Agregar subproducto / componente a la receta
  const handleAddProductComponent = (prod: any) => {
    if (selectedComponents.some((c) => c.component.id === prod.id)) return;
    const baseCost = Number(prod.total_cost) || Number(prod.direct_cost) || 0;
    setSelectedComponents((prev) => [
      ...prev,
      {
        component: {
          id: prod.id,
          name: prod.name,
          description: prod.description,
          direct_cost: Number(prod.direct_cost) || 0,
          total_cost: baseCost,
        },
        quantity: 1,
      },
    ]);
    setComponentPickerOpen(false);
    setComponentSearch("");
  };

  // Quitar subproducto de la receta
  const handleRemoveProductComponent = (index: number) => {
    setSelectedComponents((prev) => prev.filter((_, i) => i !== index));
  };

  // Cambiar cantidad de subproducto
  const handleUpdateComponentQty = (index: number, qty: number | string) => {
    setSelectedComponents((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: qty,
      };
      return updated;
    });
  };

  // Validación de Paso 1
  const validateStep1 = (): boolean => {
    const errors: { name?: string; category?: string } = {};
    const trimmed = name.trim();
    if (!trimmed) {
      errors.name = "El nombre del producto es obligatorio.";
    } else if (isDuplicateProductName(trimmed, availableProducts)) {
      errors.name = "Ya existe un producto con este nombre. Elige un nombre diferente.";
    }
    if (!category || !category.trim()) {
      errors.category = "Seleccioná una categoría para tu producto.";
    }
    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) {
      setErrorMsg(null);
      setCurrentStep(2);
    } else {
      if (isDuplicateName) {
        setErrorMsg("Ya existe un producto con este nombre. Elige un nombre diferente.");
      } else {
        setErrorMsg("Completá los campos obligatorios para continuar.");
      }
    }
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 1 && !validateStep1()) {
      if (isDuplicateName) {
        setErrorMsg("Ya existe un producto con este nombre. Elige un nombre diferente.");
      } else {
        setErrorMsg("Completá el nombre y la categoría en el Paso 1 antes de avanzar.");
      }
      return;
    }
    setErrorMsg(null);
    setCurrentStep(targetStep);
  };

  // Guardado Atómico en Supabase con Rollback
  const handleSaveProduct = async () => {
    setErrorMsg(null);
    if (!validateStep1()) {
      if (isDuplicateName) {
        setErrorMsg("Ya existe un producto con este nombre. Elige un nombre diferente.");
      } else {
        setErrorMsg("El nombre y la categoría del producto son obligatorios");
      }
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

      // Validar rendimiento
      const yieldValidation = validateProductYield(yieldValue);
      if (!yieldValidation.isValid) {
        setErrorMsg(yieldValidation.error || "El rendimiento debe ser un número mayor a 0.");
        setCurrentStep(2);
        return;
      }

      // Categoría, rendimiento y estado activo serializados
      const categoryLabel = category.trim();

      const finalDescription = serializeProductDescription({
        cleanDescription: description,
        category: categoryLabel,
        isActive: true,
        yieldValue: yieldValidation.value,
      });

      // Doble verificación en base de datos de nombre duplicado
      const nameAlreadyExistsInDb = await checkProductNameExists(supabase, name.trim());
      if (nameAlreadyExistsInDb) {
        setErrorMsg("Ya existe un producto con este nombre. Elige un nombre diferente.");
        setStep1Errors({ name: "Ya existe un producto con este nombre. Elige un nombre diferente." });
        setCurrentStep(1);
        setLoading(false);
        return;
      }

      // 1. Insertar en tabla products (costos unitarios normalizados)
      const nowIso = new Date().toISOString();
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
          direct_cost: Math.round(unitDirectCost * 100) / 100,
          labor_cost: Math.round(unitLaborCost * 100) / 100,
          indirect_cost: ind,
          total_cost: Math.round(unitTotalCost * 100) / 100,
          needs_price_review: false,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select()
        .single();

      if (productError || !productData) {
        throw new Error(productError?.message || "Error al crear el producto en la base de datos");
      }

      const productId = productData.id;

      // 2. Insertar insumos de la receta en product_supplies con ROLLBACK si falla
      if (selectedSupplies.length > 0) {
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
      }

      // 2.b. Insertar subproductos en product_components con ROLLBACK si falla
      if (selectedComponents.length > 0) {
        const componentsToInsert = selectedComponents.map((c) => ({
          parent_product_id: productId,
          component_product_id: c.component.id,
          quantity: typeof c.quantity === "number" ? c.quantity : parseFloat(String(c.quantity)) || 1,
        }));

        const { error: componentsError } = await supabase
          .from("product_components")
          .insert(componentsToInsert);

        if (componentsError) {
          console.warn("Aviso insertando subproductos componentes:", componentsError);
        }
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
        // Rollback: borrar componentes, insumos y producto
        try {
          await supabase.from("product_components").delete().eq("parent_product_id", productId);
        } catch {}
        await supabase.from("product_supplies").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
        throw new Error(`Error al guardar los precios: ${pricesError.message}. Operación revertida.`);
      }

      // Limpiar borrador persistente
      formDraftStorage.remove("haba_draft_nuevo_producto");

      // Redirigir con éxito
      router.push("/productos");
    } catch (err: any) {
      setErrorMsg(err.message || "Error inesperado al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Aviso si se recuperó un borrador previo */}
      {hasRestoredDraft && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl text-xs text-emerald-800 animate-in fade-in slide-in-from-top-1 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Recuperamos los datos que habías cargado antes.</span>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="underline hover:text-red-600 font-bold ml-3 text-neutral-600 transition-colors"
          >
            Empezar de cero
          </button>
        </div>
      )}

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
                const val = e.target.value;
                setName(val);
                if (step1Errors.name) setStep1Errors((prev) => ({ ...prev, name: undefined }));
                if (isDuplicateProductName(val, availableProducts)) {
                  setStep1Errors((prev) => ({
                    ...prev,
                    name: "Ya existe un producto con este nombre. Elige un nombre diferente.",
                  }));
                }
              }}
              placeholder="¿Qué producto vas a confeccionar?"
              className={`w-full px-3.5 py-2.5 text-xs bg-neutral-50 border rounded-2xl focus:bg-white outline-none transition ${
                step1Errors.name || isDuplicateName
                  ? "border-rose-300 ring-2 ring-rose-100 bg-rose-50/20"
                  : "border-neutral-200 focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7]"
              }`}
            />
            {(step1Errors.name || isDuplicateName) && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{step1Errors.name || "Ya existe un producto con este nombre. Elige un nombre diferente."}</span>
              </p>
            )}
          </div>

          {/* Campo: Categoría */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Categoría Artesanal <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-neutral-400 font-normal">Seleccioná o creá tu rubro</span>
            </label>

            <CategorySelector
              value={category}
              onChange={(newCat) => {
                setCategory(newCat);
                if (step1Errors.category) {
                  setStep1Errors((prev) => ({ ...prev, category: undefined }));
                }
              }}
              existingProducts={availableProducts}
              supabase={supabase}
              error={step1Errors.category}
            />

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
              disabled={isDuplicateName || !name.trim()}
              className="py-2.5 px-6 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Siguiente: Insumos</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Insumos, Subproductos & Packaging */}
      {currentStep === 2 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#3BB578]" />
              <div>
                <h3 className="text-sm font-bold text-neutral-800">2. Insumos y Subproductos Componentes</h3>
                <p className="text-[11px] text-neutral-400">
                  Cargá los materiales para 1 producto o para un lote completo indicando el rendimiento (ej. 10 unidades)
                </p>
              </div>
            </div>
          </div>


          {/* Selector de Pestañas en Paso 2: Insumos vs Subproductos */}
          <div className="flex rounded-2xl bg-neutral-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveRecipeTab("supplies")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeRecipeTab === "supplies"
                  ? "bg-white text-[#1F7A4C] shadow-xs"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-[#3BB578]" />
              <span>Insumos & Pack ({selectedSupplies.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRecipeTab("components")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeRecipeTab === "components"
                  ? "bg-white text-[#1F7A4C] shadow-xs"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <Package className="w-3.5 h-3.5 text-[#3BB578]" />
              <span>Subproductos ({selectedComponents.length})</span>
            </button>
          </div>

          {/* CONTENIDO PESTAÑA 1: INSUMOS */}
          {activeRecipeTab === "supplies" && (
            <div className="space-y-3">
              {selectedSupplies.length === 0 ? (
                <div className="space-y-3">
                  <div className="bg-neutral-50 rounded-2xl p-6 border border-dashed border-neutral-200 text-center">
                    <Boxes className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-neutral-600">
                      Aún no agregaste insumos ni packaging a este producto.
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Tocá el botón para sumar las materias primas que utilizás para fabricarlo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupplyPickerOpen(true)}
                    className="w-full py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Elegir insumo</span>
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
                    const subtotal = unitCost * itemQty;

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
                            type="button"
                            onClick={() => handleRemoveSupply(idx)}
                            className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg transition"
                            title="Quitar de la lista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-semibold text-neutral-600 flex-shrink-0">
                              Cantidad:
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={(e) => handleUpdateSupplyQty(idx, e.target.value)}
                                placeholder="1"
                                className="w-24 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                              />
                              <span className="text-[11px] font-semibold text-neutral-500 flex-shrink-0">
                                {item.supply.use_unit}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-neutral-400 block">Subtotal</span>
                            <span className="font-bold text-[#1F7A4C] text-xs">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setSupplyPickerOpen(true)}
                      className="py-2 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Insumo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO PESTAÑA 2: SUBPRODUCTOS / COMPONENTES */}
          {activeRecipeTab === "components" && (
            <div className="space-y-3">
              {selectedComponents.length === 0 ? (
                <div className="space-y-3">
                  <div className="bg-neutral-50 rounded-2xl p-6 border border-dashed border-neutral-200 text-center">
                    <Package className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-neutral-600">
                      No agregaste subproductos a este producto.
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Ideal para armar combos, kits o productos ensamblados a partir de otros productos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComponentPickerOpen(true)}
                    className="w-full py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Elegir subproducto</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedComponents.map((item, idx) => {
                    const unitCost = Number(item.component.total_cost) || Number(item.component.direct_cost) || 0;
                    const itemQty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
                    const subtotal = unitCost * itemQty;

                    return (
                      <div
                        key={item.component.id || idx}
                        className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex flex-col space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-neutral-800 block">
                                {item.component.name}
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                Costo base unitario: <strong>{formatCurrency(unitCost)}</strong> / u
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveProductComponent(idx)}
                            className="p-1 text-neutral-400 hover:text-rose-500 rounded-lg transition"
                            title="Quitar de la receta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/50 items-center">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-neutral-600">
                              Cantidad necesaria:
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={(e) => handleUpdateComponentQty(idx, e.target.value)}
                                placeholder="1"
                                className="w-full px-2 py-1 text-xs bg-white border border-neutral-200 rounded-xl text-center font-bold outline-none focus:border-[#3BB578]"
                              />
                              <span className="text-[11px] font-semibold text-neutral-500 flex-shrink-0">
                                u
                              </span>
                            </div>
                          </div>

                          <div className="text-right space-y-0.5">
                            <span className="text-[10px] text-neutral-400 block">Subtotal al costo:</span>
                            <span className="text-xs font-bold text-[#1F7A4C]">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setComponentPickerOpen(true)}
                      className="py-2 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar otro Subproducto</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tarjeta Unificada de Rendimiento del Lote y Resumen de Costos */}
          <ProductYieldCard
            yieldValue={yieldValue}
            onChangeYield={setYieldValue}
            batchMaterialsCost={batchDirectCost}
            suppliesCost={suppliesCost}
            componentsCost={componentsCost}
            unitDirectCost={unitDirectCost}
          />

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-2xl text-xs font-semibold transition"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="py-2.5 px-6 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
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

          <div className="p-5 sm:p-6 bg-neutral-50/80 rounded-3xl border border-neutral-200/80 space-y-5">
            {/* Input principal centrado y ergonómico */}
            <div className="flex flex-col items-center text-center space-y-3 py-1">
              <label className="text-sm sm:text-base font-bold text-neutral-800">
                ¿Cuánto tiempo lleva realizar este producto?
              </label>
              <p className="text-[11.5px] text-neutral-500 max-w-sm">
                Ingresá los minutos de trabajo dedicados a cada unidad (opcional)
              </p>

              {/* Control de minutos centrado */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <input
                  type="number"
                  min="0"
                  value={workTimeMinutes === 0 || workTimeMinutes === "" ? "" : workTimeMinutes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkTimeMinutes(val === "" ? "" : Math.max(0, parseFloat(val) || 0));
                  }}
                  placeholder="0"
                  className="w-32 sm:w-36 h-12 px-3 text-lg sm:text-xl font-black text-center text-neutral-800 bg-white border border-neutral-200 rounded-2xl outline-none focus:border-[#3BB578] focus:ring-4 focus:ring-[#DCF4D7] transition shadow-xs"
                />
                <span className="text-sm font-bold text-neutral-600">minutos</span>
                {Number(workTimeMinutes) >= 60 && (
                  <span className="text-xs text-[#1F7A4C] bg-[#DCF4D7] px-2.5 py-1 rounded-xl font-bold whitespace-nowrap ml-1">
                    ~{(Number(workTimeMinutes) / 60).toFixed(1)} hs
                  </span>
                )}
              </div>

              {/* Atajos de minutos para carga rápida en móvil y escritorio */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center pt-1.5">
                {[10, 15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setWorkTimeMinutes(mins)}
                    className={`px-2.5 py-1 text-xs rounded-xl font-semibold transition cursor-pointer active:scale-95 ${
                      Number(workTimeMinutes) === mins
                        ? "bg-[#1F7A4C] text-white shadow-2xs"
                        : "bg-white border border-neutral-200 text-neutral-600 hover:border-[#3BB578] hover:text-[#1F7A4C]"
                    }`}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
                {(Number(workTimeMinutes) || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setWorkTimeMinutes("")}
                    className="px-2 py-1 text-[11px] rounded-xl text-neutral-400 hover:text-rose-500 transition cursor-pointer"
                    title="Borrar minutos asignados"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>

            {/* Tarjeta compacta del costo productivo resultante */}
            <div className="pt-3 border-t border-neutral-200/60">
              <div className="bg-[#DCF4D7]/70 border border-[#C3EBC0] p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-bold text-[#1F7A4C] block">
                    Costo productivo del tiempo:
                  </span>
                  <span className="text-[11px] font-mono text-[#1F7A4C]/90 block truncate">
                    {(Number(workTimeMinutes) || 0) > 0
                      ? `${workTimeMinutes} min × ${formatCurrency(laborMinuteRate)}/min`
                      : "0 min (sin tiempo productivo asignado)"}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-base sm:text-lg font-black text-[#1F7A4C]">
                    {formatCurrency(laborCost)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 mt-2 text-center leading-relaxed">
                Este costo incluye proporcionalmente tus gastos operativos y tu sueldo pretendido según tu Objetivo Mensual.
              </p>
            </div>

            {/* Enlace educativo para desplegar explicación */}
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => setShowTimeInfo(!showTimeInfo)}
                className="text-[11px] font-bold text-[#1F7A4C] hover:text-[#165837] underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showTimeInfo ? "Ocultar cómo se calcula" : "¿Cómo se calcula esto?"}</span>
              </button>
            </div>

            {showTimeInfo && (
              <div className="p-3.5 bg-[#F0FAF4] border border-[#C3EBC0] rounded-2xl space-y-2 text-xs text-[#2B2B2B] animate-in fade-in duration-200 shadow-xs">
                <div className="flex items-center justify-between font-bold text-[#1F7A4C] border-b border-[#DCF4D7] pb-1.5">
                  <span className="flex items-center gap-1.5 font-display text-[11.5px]">
                    <Calculator className="w-3.5 h-3.5 text-[#3BB578]" />
                    ¿Cómo calcula HABA el costo de tu tiempo?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTimeInfo(false)}
                    className="text-[#7A7A7A] hover:text-[#2B2B2B] text-xs font-semibold cursor-pointer p-0.5"
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
                    {(Number(workTimeMinutes) || 0) > 0
                      ? `${workTimeMinutes} min × ${formatCurrency(laborMinuteRate)}/min = `
                      : "0 min × tarifa = "}
                    <strong>{formatCurrency(laborCost)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-2xl text-xs font-semibold transition cursor-pointer"
            >
              Atrás
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="py-2.5 px-5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Siguiente: Precios</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Precios Multicanal */}
      {currentStep === 4 && (
        <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
          <ProductPricingChannels
            channels={channelPrices}
            onChange={setChannelPrices}
            unitCost={totalCost}
            batchTotalCost={batchTotalCost}
            yieldQuantity={safeYield}
            title="4. Precios por Canal de Venta"
          />

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

            {/* Botón para crear insumo al vuelo */}
            <div className="pt-2 pb-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setNewSupplyInitialName(supplySearch.trim());
                  setIsCreateSupplyOpen(true);
                }}
                className="w-full py-2 px-3 bg-[#DCF4D7]/70 hover:bg-[#DCF4D7] text-[#1F7A4C] border border-[#C3EBC0] rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.99]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {supplySearch.trim()
                    ? `+ Crear "${supplySearch.trim()}" como nuevo insumo`
                    : "+ Crear nuevo insumo"}
                </span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 my-3 space-y-2 pr-1 overscroll-contain">
              {(() => {
                const filtered = availableSupplies.filter((sup) =>
                  matchesSearch([sup.name, sup.category], supplySearch)
                );

                if (availableSupplies.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-neutral-400 space-y-3">
                      <p className="text-neutral-500">No tenés insumos cargados en tu catálogo.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSupplyInitialName("");
                          setIsCreateSupplyOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Crear primer insumo</span>
                      </button>
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-neutral-400 space-y-3">
                      <p>
                        No encontramos insumos que coincidan con &ldquo;<strong>{supplySearch}</strong>&rdquo;.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSupplyInitialName(supplySearch.trim());
                          setIsCreateSupplyOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Crear &ldquo;{supplySearch.trim()}&rdquo; ahora</span>
                      </button>
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
      {/* MODAL SELECCIONADOR DE SUBPRODUCTOS COMPONENTES */}
      {componentPickerOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] flex flex-col animate-in slide-in-from-bottom-6"
            style={{
              height: 'min(88vh, 600px)',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 20px) - 10px)'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-800">Elegir Subproducto</h3>
                  <p className="text-[10.5px] text-neutral-400">Sumará solo su costo base de fabricación</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComponentPickerOpen(false);
                  setComponentSearch("");
                }}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Buscador de Subproductos */}
            <div className="pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  placeholder="Buscar producto por nombre..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:bg-white focus:border-[#3BB578]"
                  autoFocus
                />
                {componentSearch && (
                  <button
                    type="button"
                    onClick={() => setComponentSearch("")}
                    className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Subproductos disponibles */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
              {(() => {
                const filtered = availableProducts.filter((p) =>
                  matchesSearch([p.name, p.category, p.description], componentSearch)
                );

                if (availableProducts.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-neutral-400">
                      No tenés otros productos registrados aún en tu catálogo. Creá primero los productos simples y luego podrás combinarlos aquí.
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-neutral-400">
                      No encontramos productos que coincidan con &ldquo;<strong>{componentSearch}</strong>&rdquo;.
                    </div>
                  );
                }

                return filtered.map((prod) => {
                  const isSelected = selectedComponents.some((c) => c.component.id === prod.id);
                  const baseCost = Number(prod.total_cost) || Number(prod.direct_cost) || 0;
                  const badge = getCategoryBadge(prod.description);

                  return (
                    <button
                      key={prod.id}
                      disabled={isSelected}
                      onClick={() => handleAddProductComponent(prod)}
                      className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? "bg-neutral-100 border-neutral-200 opacity-50 cursor-not-allowed"
                          : "bg-white hover:bg-[#DCF4D7]/50 border-neutral-200 hover:border-[#3BB578]"
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-neutral-800 block">
                          {prod.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                          <span>{badge.icon}</span>
                          <span>{badge.label}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#1F7A4C]">
                          {formatCurrency(baseCost)}
                        </span>
                        <span className="text-[9px] block text-neutral-400 font-medium">
                          costo base / u
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
                type="button"
                onClick={() => {
                  setComponentPickerOpen(false);
                  setComponentSearch("");
                }}
                className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-2xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal secundario para creación de insumos al vuelo */}
      <SupplyModal
        isOpen={isCreateSupplyOpen}
        onClose={() => setIsCreateSupplyOpen(false)}
        onSuccess={handleSupplyCreatedInline}
        initialSupply={newSupplyInitialName ? { name: newSupplyInitialName } : null}
        zIndex="z-[100001]"
      />

      {/* Toast de confirmación */}
      {successToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[100002] bg-[#1F7A4C] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-400/30 animate-in fade-in slide-in-from-bottom-3 duration-200 w-max max-w-[calc(100vw-2rem)]"
          style={{
            bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
        >
          <Sparkles className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span className="leading-tight">{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="ml-2 text-emerald-200 hover:text-white p-0.5 rounded-lg transition flex-shrink-0"
            aria-label="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
