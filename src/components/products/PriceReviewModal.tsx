"useClient";
import React from "react";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  X,
  Boxes,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/units";
import { ModifiedSupplyInfo } from "@/lib/products";

interface PriceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onRecalculate: (product: any) => Promise<void>;
  onDismissAlert: (product: any) => Promise<void>;
  isRecalculating?: boolean;
}

export const PriceReviewModal: React.FC<PriceReviewModalProps> = ({
  isOpen,
  onClose,
  product,
  onRecalculate,
  onDismissAlert,
  isRecalculating = false,
}) => {
  if (!isOpen || !product) return null;

  const modifiedSupplies: ModifiedSupplyInfo[] = product.modifiedSupplies || [];
  const currentMaterialsCost = Number(product.currentMaterialsCost) || 0;
  const savedDirectCost = Number(product.direct_cost) || 0;
  const costDiff = currentMaterialsCost - savedDirectCost;
  const totalLaborCost = product.include_labor ? Number(product.labor_cost || 0) : 0;
  const savedTotalCost = Number(product.total_cost) || (savedDirectCost + totalLaborCost);
  const newTotalCost = currentMaterialsCost + totalLaborCost;

  const handleConfirmRecalculate = async () => {
    await onRecalculate(product);
    onClose();
  };

  const handleConfirmDismiss = async () => {
    await onDismissAlert(product);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between bg-amber-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                  Revisión de Precios
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 flex-shrink-0">
                  {modifiedSupplies.length}{" "}
                  {modifiedSupplies.length === 1 ? "insumo modificado" : "insumos modificados"}
                </span>
              </div>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                Producto: <strong className="text-neutral-800">{product.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/80 rounded-xl transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-neutral-700 flex-1">
          {/* Mensaje explicativo */}
          <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60 text-neutral-600 space-y-1">
            <p className="leading-relaxed">
              Detectamos que el costo de reposición de uno o más insumos cambió desde la última vez que guardaste este producto.
            </p>
            <p className="text-[11px] text-neutral-400">
              Revisá el detalle de cada insumo afectado y decidí si querés recalcular los costos y actualizar los precios de venta en tus canales.
            </p>
          </div>

          {/* Listado explícito de insumos modificados */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-amber-600" />
              Insumos con variación de precio:
            </h4>

            {modifiedSupplies.length === 0 ? (
              <div className="p-3 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-center text-neutral-500 text-xs italic">
                El costo total de la receta difiere del costo guardado ({formatCurrency(savedDirectCost)} vs {formatCurrency(currentMaterialsCost)}).
              </div>
            ) : (
              <div className="space-y-2.5">
                {modifiedSupplies.map((item) => (
                  <div
                    key={item.supplyId}
                    className="p-3 bg-amber-50/40 rounded-2xl border border-amber-200/80 space-y-2 hover:bg-amber-50/60 transition"
                  >
                    {/* Nombre y Badge de aumento */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-neutral-900 text-sm">
                            {item.name}
                          </span>
                          {item.category && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-neutral-200/60 text-neutral-600">
                              {item.category === "packaging" ? "Packaging" : "Materia prima"}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-500 block mt-0.5">
                          Uso en receta: <strong>{item.quantity} {item.useUnit}</strong>
                        </span>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-lg border shadow-2xs ${
                            item.isIncrease
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          {item.isIncrease ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {item.isIncrease ? "+" : ""}
                          {formatCurrency(item.priceDiff)} ({item.isIncrease ? "+" : ""}
                          {item.percentChange}%)
                        </span>
                      </div>
                    </div>

                    {/* Comparación de precio de reposición */}
                    <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-xl border border-amber-200/50 text-[11px]">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Precio anterior:</span>
                        <span className="font-semibold text-neutral-700">
                          {formatCurrency(item.prevPrice)} / {item.purchaseUnit}
                        </span>
                        <span className="text-[10px] text-neutral-400 block">
                          ({formatCurrency(item.prevUnitCost)} / {item.useUnit})
                        </span>
                      </div>
                      <div className="border-l border-neutral-100 pl-2">
                        <span className="text-neutral-400 block text-[10px]">Precio actual:</span>
                        <span className="font-bold text-amber-900">
                          {formatCurrency(item.newPrice)} / {item.purchaseUnit}
                        </span>
                        <span className="text-[10px] text-amber-700 block">
                          ({formatCurrency(item.newUnitCost)} / {item.useUnit})
                        </span>
                      </div>
                    </div>

                    {/* Impacto estimado en el costo del producto */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5 text-neutral-600">
                      <span>Impacto en costo de este producto:</span>
                      <strong className={`font-bold ${item.isIncrease ? "text-amber-800" : "text-emerald-700"}`}>
                        {item.isIncrease ? "+" : ""}
                        {formatCurrency(item.costImpact)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen comparativo de costos */}
          <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/70 space-y-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
              Resumen de Costos del Producto:
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-white rounded-xl border border-neutral-200/60">
                <span className="text-[10px] text-neutral-400 block">Costo Guardado</span>
                <span className="font-bold text-neutral-800 text-xs">
                  {formatCurrency(savedDirectCost)}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-neutral-200/60">
                <span className="text-[10px] text-neutral-400 block">Nuevo Costo</span>
                <span className="font-bold text-amber-800 text-xs">
                  {formatCurrency(currentMaterialsCost)}
                </span>
              </div>
              <div className="p-2 bg-amber-100/50 rounded-xl border border-amber-200/60">
                <span className="text-[10px] text-amber-700 block">Diferencia</span>
                <span className="font-extrabold text-amber-900 text-xs">
                  {costDiff > 0 ? "+" : ""}
                  {formatCurrency(costDiff)}
                </span>
              </div>
            </div>

            {product.include_labor && (
              <div className="text-[11px] text-neutral-500 flex justify-between pt-1 border-t border-neutral-200/40">
                <span>Costo productivo (mano de obra):</span>
                <span>{formatCurrency(totalLaborCost)}</span>
              </div>
            )}
          </div>

          {/* Simulación de Precios de Venta por Canal */}
          {product.product_prices && product.product_prices.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                Simulación de Precios por Canal (manteniendo márgenes):
              </span>
              <div className="space-y-1.5">
                {product.product_prices.map((price: any) => {
                  const margin = Number(price.profit_margin_percent) || 0;
                  const currentSelling = Number(price.selling_price) || 0;
                  const suggestedSelling = Math.round(newTotalCost * (1 + margin / 100));
                  const sellingDiff = suggestedSelling - currentSelling;

                  return (
                    <div
                      key={price.id}
                      className="p-2.5 bg-white rounded-xl border border-neutral-200/70 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-neutral-800">
                            {price.channel_name || "General"}
                          </span>
                          <span className="text-[10px] font-semibold text-neutral-400">
                            ({margin}% margen)
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          Actual: {formatCurrency(currentSelling)}
                        </span>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="font-extrabold text-[#1F7A4C] text-sm">
                            {formatCurrency(suggestedSelling)}
                          </span>
                          {sellingDiff !== 0 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              {sellingDiff > 0 ? "+" : ""}
                              {formatCurrency(sellingDiff)}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-neutral-400 block">Sugerido al recalcular</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción bien definidos */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleConfirmDismiss}
            disabled={isRecalculating}
            className="w-full sm:w-auto py-2 px-4 rounded-xl border border-neutral-300 hover:bg-neutral-200/60 active:scale-95 text-neutral-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Descartar alerta sin modificar precios ni costos guardados"
          >
            <X className="w-3.5 h-3.5" />
            <span>Omitir por ahora</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmRecalculate}
            disabled={isRecalculating}
            className="w-full sm:w-auto py-2 px-4 bg-[#1F7A4C] hover:bg-[#165837] active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            title="Actualizar costos y márgenes de los canales con precios vigentes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
            <span>{isRecalculating ? "Recalculando..." : "Recalcular precios ahora"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
