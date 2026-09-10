"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Trash2,
  ShieldAlert,
  Package,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SupplyItem } from "@/components/SupplyModal";
import { HabaMascot } from "@/components/HabaMascot";

interface DeleteSupplyModalProps {
  isOpen: boolean;
  supply: SupplyItem | null;
  onClose: () => void;
  onSuccess: (deletedSupplyId: string) => void;
}

export const DeleteSupplyModal: React.FC<DeleteSupplyModalProps> = ({
  isOpen,
  supply,
  onClose,
  onSuccess,
}) => {
  const supabase = createClient();

  const [status, setStatus] = useState<
    "checking" | "has_dependencies" | "can_delete" | "deleting" | "error"
  >("checking");
  const [blockingProducts, setBlockingProducts] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkIntegrity = async () => {
    if (!supply?.id) return;

    setStatus("checking");
    setErrorMessage(null);
    setBlockingProducts([]);

    try {
      // 1. Consultar si el insumo está registrado en alguna receta/producto
      const { data: usages, error: usagesError } = await supabase
        .from("product_supplies")
        .select("product_id")
        .eq("supply_id", supply.id);

      if (usagesError) throw usagesError;

      if (usages && usages.length > 0) {
        // Filtrar IDs únicos de productos asociados
        const productIds = Array.from(
          new Set(usages.map((u: any) => u.product_id).filter(Boolean))
        );

        if (productIds.length > 0) {
          // Obtener los nombres de los productos que lo usan
          const { data: productsData, error: productsError } = await supabase
            .from("products")
            .select("id, name")
            .in("id", productIds);

          if (productsError) throw productsError;

          const list = (productsData || []).map((p: any) => ({
            id: p.id,
            name: p.name || "Producto sin nombre",
          }));

          setBlockingProducts(list);
          setStatus("has_dependencies");
          return;
        }
      }

      // Si no tiene recetas vinculadas, se puede eliminar libremente
      setStatus("can_delete");
    } catch (err: any) {
      console.error("Error validando dependencias del insumo:", err);
      setErrorMessage(
        err.message || "Ocurrió un error al verificar el uso del insumo."
      );
      setStatus("error");
    }
  };

  useEffect(() => {
    if (isOpen && supply?.id) {
      checkIntegrity();
    } else {
      setStatus("checking");
      setBlockingProducts([]);
      setErrorMessage(null);
    }
  }, [isOpen, supply]);

  const handleConfirmDelete = async () => {
    if (!supply?.id) return;

    try {
      setStatus("deleting");
      setErrorMessage(null);

      // 1. Limpiar registros de historial de precios vinculados para evitar datos huérfanos
      const { error: histError } = await supabase
        .from("supply_price_history")
        .delete()
        .eq("supply_id", supply.id);

      if (histError) {
        console.warn("Aviso al limpiar supply_price_history:", histError.message);
      }

      // 2. Eliminar el insumo de la tabla supplies
      const { error: deleteError } = await supabase
        .from("supplies")
        .delete()
        .eq("id", supply.id);

      if (deleteError) throw deleteError;

      // 3. Notificar a la vista padre y cerrar
      onSuccess(supply.id);
      onClose();
    } catch (err: any) {
      console.error("Error al eliminar insumo:", err);
      setErrorMessage(
        err.message || "No se pudo eliminar el insumo. Intentalo de nuevo."
      );
      setStatus("can_delete");
    }
  };

  if (!isOpen || !supply) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-neutral-100 p-5 sm:p-6 relative animate-in zoom-in-95 duration-200">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          disabled={status === "deleting"}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition disabled:opacity-40"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ESTADO 1: VERIFICANDO INTEGRIDAD */}
        {status === "checking" && (
          <div className="py-6 flex flex-col items-center text-center space-y-3">
            <HabaMascot size={68} className="animate-bounce" />
            <div>
              <h3 className="text-sm font-bold text-neutral-800">
                Comprobando recetas...
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-[240px]">
                Verificando que &ldquo;{supply.name}&rdquo; no esté en uso en tus
                productos.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[#1F7A4C] text-[11px] font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Validando integridad...</span>
            </div>
          </div>
        )}

        {/* ESTADO 2: BLOQUEO POR DEPENDENCIAS EN RECETAS ACTIVAS */}
        {status === "has_dependencies" && (
          <div className="flex flex-col text-center space-y-3 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100 shadow-2xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-block mb-1.5">
                Insumo en uso
              </span>
              <h3 className="text-sm sm:text-base font-bold text-neutral-800">
                No podés eliminar este insumo
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                <span className="font-semibold text-neutral-800">
                  {supply.name}
                </span>{" "}
                está asignado en la receta de{" "}
                {blockingProducts.length === 1
                  ? "este producto activo"
                  : "los siguientes productos activos"}
                :
              </p>
            </div>

            {/* Lista de productos dependientes */}
            <div className="bg-neutral-50 rounded-2xl p-2.5 border border-neutral-200/70 max-h-36 overflow-y-auto space-y-1.5 text-left">
              {blockingProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-white px-2.5 py-2 rounded-xl border border-neutral-100 shadow-2xs"
                >
                  <div className="w-6 h-6 rounded-lg bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-700 truncate">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Consejo didáctico de HABA */}
            <div className="bg-amber-50/70 border border-amber-200/50 rounded-2xl p-2.5 text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-tight">
                Para eliminarlo, primero entrá a cada producto y reemplazalo o
                quitalo de su receta de ingredientes.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-1 py-2.5 bg-neutral-800 hover:bg-neutral-900 active:scale-[0.99] text-white text-xs font-bold rounded-2xl transition shadow-sm"
            >
              Entendido
            </button>
          </div>
        )}

        {/* ESTADO 3: CONFIRMACIÓN DE ELIMINACIÓN SEGURA */}
        {(status === "can_delete" || status === "deleting") && (
          <div className="flex flex-col text-center space-y-3 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 inline-block mb-1.5">
                Confirmar eliminación
              </span>
              <h3 className="text-sm sm:text-base font-bold text-neutral-800">
                ¿Eliminar &ldquo;{supply.name}&rdquo;?
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Se quitará de tu catálogo de insumos y también se eliminará su
                historial de precios registrado.
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-700 text-xs text-left flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-2.5 text-[11px] text-neutral-500">
              Esta acción es definitiva y no se puede deshacer.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={status === "deleting"}
                className="flex-1 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.99] rounded-2xl transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={status === "deleting"}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.99] rounded-2xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {status === "deleting" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ESTADO 4: ERROR DE CONEXIÓN O VALIDACIÓN */}
        {status === "error" && (
          <div className="flex flex-col text-center space-y-3 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-neutral-800">
                Error al verificar el insumo
              </h3>
              <p className="text-xs text-rose-600 mt-1">
                {errorMessage || "No se pudo comprobar la integridad del insumo."}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-2xl transition"
              >
                Cerrar
              </button>
              <button
                onClick={checkIntegrity}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#3BB578] hover:bg-[#2E9E65] rounded-2xl transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
