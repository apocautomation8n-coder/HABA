"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  TrendingUp,
  Pencil,
  Trash2,
  Plus,
  Tag,
  Store,
  Users,
  Truck,
  Globe,
  RotateCcw,
} from "lucide-react";
import { formatCurrency } from "@/lib/units";

export interface ChannelPriceItem {
  id?: string;
  channel_name: string;
  profit_margin_percent: number | string;
  selling_price: number | string;
}

export interface ProductPricingChannelsProps {
  channels: ChannelPriceItem[];
  onChange: (channels: ChannelPriceItem[]) => void;
  unitCost: number;
  batchTotalCost?: number;
  yieldQuantity?: number;
  title?: string;
  subtitle?: string;
  showExplanationBanner?: boolean;
  className?: string;
}

export const DEFAULT_CHANNELS: ChannelPriceItem[] = [
  { id: "pormenor", channel_name: "Por Menor", profit_margin_percent: 100, selling_price: 0 },
  { id: "pormayor", channel_name: "Por Mayor", profit_margin_percent: 50, selling_price: 0 },
];

export const getChannelIcon = (id?: string, name?: string) => {
  const key = `${id || ""} ${name || ""}`.toLowerCase();
  if (key.includes("menor") || key.includes("local") || key.includes("minorista") || key.includes("directo")) {
    return <Store className="w-4 h-4 text-emerald-600" />;
  }
  if (key.includes("mayor") || key.includes("revendedora") || key.includes("distribuidor") || key.includes("b2b")) {
    return <Users className="w-4 h-4 text-purple-600" />;
  }
  if (key.includes("delivery") || key.includes("envio") || key.includes("reparto")) {
    return <Truck className="w-4 h-4 text-blue-600" />;
  }
  if (key.includes("web") || key.includes("online") || key.includes("tienda") || key.includes("ecommerce")) {
    return <Globe className="w-4 h-4 text-amber-600" />;
  }
  return <Tag className="w-4 h-4 text-neutral-500" />;
};

export function ProductPricingChannels({
  channels,
  onChange,
  unitCost,
  title = "Precios por Canal de Venta",
  className = "",
}: ProductPricingChannelsProps) {
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelMargin, setNewChannelMargin] = useState<number | string>(100);

  // Sincronizar precios de venta cuando el costo unitario cambia
  const prevUnitCostRef = useRef<number>(unitCost);
  const channelsRef = useRef<ChannelPriceItem[]>(channels);
  channelsRef.current = channels;

  useEffect(() => {
    if (prevUnitCostRef.current !== unitCost) {
      prevUnitCostRef.current = unitCost;
      const safeCost = Math.max(0, unitCost || 0);
      onChange(
        channelsRef.current.map((ch) => {
          const marginNum =
            typeof ch.profit_margin_percent === "number"
              ? ch.profit_margin_percent
              : parseFloat(String(ch.profit_margin_percent));

          if (isNaN(marginNum)) return ch;

          return {
            ...ch,
            selling_price: safeCost > 0 ? Math.round(safeCost * (1 + marginNum / 100)) : ch.selling_price,
          };
        })
      );
    }
  }, [unitCost, onChange]);

  // Modificar margen % de un canal -> recalcula precio de venta
  const handleMarginChange = (index: number, marginVal: number | string) => {
    const updated = [...channels];
    if (marginVal === "" || isNaN(Number(marginVal))) {
      updated[index] = {
        ...updated[index],
        profit_margin_percent: marginVal,
        selling_price: "",
      };
      onChange(updated);
      return;
    }

    const marginNum = typeof marginVal === "number" ? marginVal : parseFloat(String(marginVal));
    if (isNaN(marginNum)) {
      updated[index] = {
        ...updated[index],
        profit_margin_percent: marginVal,
        selling_price: "",
      };
      onChange(updated);
      return;
    }

    const safeCost = Math.max(0, unitCost || 0);
    const calculatedPrice = safeCost > 0 ? Math.round(safeCost * (1 + marginNum / 100)) : 0;

    updated[index] = {
      ...updated[index],
      profit_margin_percent: marginVal,
      selling_price: calculatedPrice >= 0 ? calculatedPrice : 0,
    };
    onChange(updated);
  };

  // Modificar precio final manual -> recalcula margen %
  const handlePriceChange = (index: number, priceVal: number | string) => {
    const updated = [...channels];
    if (priceVal === "" || isNaN(Number(priceVal))) {
      updated[index] = {
        ...updated[index],
        profit_margin_percent: "",
        selling_price: priceVal,
      };
      onChange(updated);
      return;
    }

    const priceNum = typeof priceVal === "number" ? priceVal : parseFloat(String(priceVal));
    if (isNaN(priceNum)) {
      updated[index] = {
        ...updated[index],
        profit_margin_percent: "",
        selling_price: priceVal,
      };
      onChange(updated);
      return;
    }

    const safeCost = Math.max(0, unitCost || 0);
    let newMargin = 0;
    if (safeCost > 0) {
      const rawMargin = ((priceNum - safeCost) / safeCost) * 100;
      newMargin = isFinite(rawMargin) ? Math.round(rawMargin) : 0;
    } else if (priceNum > 0) {
      newMargin = 100;
    }

    updated[index] = {
      ...updated[index],
      profit_margin_percent: newMargin,
      selling_price: priceVal,
    };
    onChange(updated);
  };

  // Modificar nombre del canal
  const handleNameChange = (index: number, newName: string) => {
    const updated = [...channels];
    updated[index] = {
      ...updated[index],
      channel_name: newName,
    };
    onChange(updated);
  };

  // Eliminar canal de venta con validación de al menos un canal
  const handleRemoveChannel = (index: number) => {
    if (channels.length <= 1) {
      alert("Debes mantener al menos un canal de venta para el producto.");
      return;
    }
    onChange(channels.filter((_, i) => i !== index));
  };

  // Agregar nuevo canal
  const handleAddChannel = () => {
    const trimmed = newChannelName.trim();
    if (!trimmed) return;
    if (
      channels.some(
        (c) => c.channel_name.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      alert(`Ya existe un canal configurado con el nombre "${trimmed}". Elige un nombre diferente.`);
      return;
    }
    const marginNum =
      typeof newChannelMargin === "number"
        ? newChannelMargin
        : parseFloat(String(newChannelMargin)) || 0;
    const safeCost = Math.max(0, unitCost || 0);
    const calculatedPrice = safeCost > 0 ? Math.round(safeCost * (1 + marginNum / 100)) : 0;

    onChange([
      ...channels,
      {
        id: `custom-${Date.now()}`,
        channel_name: trimmed,
        profit_margin_percent: marginNum,
        selling_price: calculatedPrice,
      },
    ]);

    setNewChannelName("");
    setNewChannelMargin(100);
    setIsAddingChannel(false);
  };

  // Restaurar canales sugeridos predeterminados
  const handleRestoreDefaults = () => {
    const safeCost = Math.max(0, unitCost || 0);
    onChange([
      {
        id: `custom-${Date.now()}-1`,
        channel_name: "Por Menor",
        profit_margin_percent: 100,
        selling_price: Math.round(safeCost * 2),
      },
      {
        id: `custom-${Date.now()}-2`,
        channel_name: "Por Mayor",
        profit_margin_percent: 50,
        selling_price: Math.round(safeCost * 1.5),
      },
    ]);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Encabezado limpio de la Sección */}
      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-neutral-800">{title}</h3>
      </div>

      {/* Lista de Canales de Venta */}
      {channels.length === 0 ? (
        <div className="p-4 bg-white rounded-2xl border border-dashed border-amber-300 text-center space-y-2">
          <p className="text-xs text-neutral-600 font-medium">
            No hay canales de venta configurados para este producto.
          </p>
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="text-xs text-[#1F7A4C] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restaurar canales sugeridos (Por Menor y Por Mayor)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((channel, idx) => {
            const channelSellingPrice =
              typeof channel.selling_price === "number"
                ? channel.selling_price
                : parseFloat(String(channel.selling_price)) || 0;
            const profitAmount = channelSellingPrice - (unitCost || 0);

            return (
              <div
                key={channel.id || idx}
                className="p-3.5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3 hover:border-[#3BB578]/50 transition"
              >
                {/* Cabecera del Canal: Icono, Nombre Editable y Botón Eliminar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1.5 bg-white rounded-lg border border-neutral-200 shadow-2xs flex-shrink-0">
                      {getChannelIcon(channel.id, channel.channel_name)}
                    </div>
                    <div className="relative flex items-center flex-1 max-w-[260px] group">
                      <input
                        type="text"
                        value={channel.channel_name}
                        onChange={(e) => handleNameChange(idx, e.target.value)}
                        placeholder="Nombre del canal..."
                        className="text-xs font-bold text-neutral-800 bg-white border border-neutral-200/90 group-hover:border-[#3BB578]/60 focus:border-[#3BB578] focus:ring-2 focus:ring-[#3BB578]/10 pl-2.5 pr-7 py-1 rounded-xl outline-none transition w-full shadow-2xs"
                        title="Hacé clic para renombrar este canal de venta"
                      />
                      <Pencil className="w-3 h-3 text-neutral-400 group-hover:text-[#3BB578] group-focus-within:text-[#3BB578] absolute right-2.5 pointer-events-none transition" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      disabled={channels.length <= 1}
                      onClick={() => handleRemoveChannel(idx)}
                      className={`p-1.5 rounded-lg transition ${
                        channels.length <= 1
                          ? "text-neutral-300 cursor-not-allowed opacity-40"
                          : "text-neutral-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      }`}
                      title={
                        channels.length <= 1
                          ? "Debes mantener al menos un canal de venta activo"
                          : "Eliminar este canal de venta"
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Fila Horizontal: Margen de Ganancia (%) y Precio de Lista ($) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 items-end">
                  {/* Margen de Ganancia (%) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 block">
                      Margen de Ganancia
                    </label>
                    <div className="relative flex items-center bg-neutral-50 hover:bg-white focus-within:bg-white rounded-xl border border-neutral-200 focus-within:border-[#3BB578] focus-within:ring-2 focus-within:ring-[#3BB578]/10 transition shadow-2xs">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={channel.profit_margin_percent === "" ? "" : channel.profit_margin_percent}
                        onChange={(e) => handleMarginChange(idx, e.target.value)}
                        placeholder="0"
                        className="w-full h-10 pl-3 pr-7 text-xs sm:text-sm font-bold text-[#1F7A4C] bg-transparent outline-none"
                      />
                      <span className="absolute right-2.5 text-xs font-bold text-neutral-400 pointer-events-none select-none">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Precio de Lista ($) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 block">
                      Precio de Lista
                    </label>
                    <div className="relative flex items-center bg-neutral-50 hover:bg-white focus-within:bg-white rounded-xl border border-neutral-200 focus-within:border-[#3BB578] focus-within:ring-2 focus-within:ring-[#3BB578]/10 transition shadow-2xs">
                      <span className="absolute left-2.5 text-xs font-bold text-neutral-400 pointer-events-none select-none">
                        $
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={channel.selling_price === "" ? "" : channel.selling_price}
                        onChange={(e) => handlePriceChange(idx, e.target.value)}
                        placeholder="0"
                        className="w-full h-10 pl-6 pr-3 text-xs sm:text-sm font-black text-neutral-800 bg-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Desglose compacto: Costo + Ganancia = Total */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[10.5px] text-neutral-500 font-medium">
                  <span>
                    Costo: <strong className="text-neutral-700">{formatCurrency(unitCost)}</strong>
                  </span>
                  <span>+</span>
                  <span>
                    Ganancia:{" "}
                    <strong className={profitAmount >= 0 ? "text-[#1F7A4C]" : "text-rose-600"}>
                      {formatCurrency(profitAmount)}
                    </strong>
                  </span>
                  <span>=</span>
                  <span>
                    Total: <strong className="text-neutral-900 font-bold">{formatCurrency(channelSellingPrice)}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulario / Botón para agregar nuevo canal de venta */}
      {isAddingChannel ? (
        <div className="p-3.5 bg-neutral-50 rounded-2xl border-2 border-dashed border-[#3BB578] space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1F7A4C] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Nuevo Canal de Venta
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingChannel(false);
                setNewChannelName("");
              }}
              className="text-neutral-400 hover:text-neutral-600 text-xs cursor-pointer"
            >
              ✕ Cancelar
            </button>
          </div>

          {/* Chips con sugerencias rápidas */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-neutral-400 font-medium mr-0.5">Sugerencias:</span>
            {[
              { name: "Por Mayor", margin: 50 },
              { name: "Mayorista B2B", margin: 40 },
              { name: "Canal Web", margin: 80 },
              { name: "Revendedoras", margin: 60 },
              { name: "Feria / Promo", margin: 70 },
            ].map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setNewChannelName(preset.name);
                  setNewChannelMargin(preset.margin);
                }}
                className="text-[10px] font-semibold bg-white hover:bg-[#DCF4D7] text-neutral-700 hover:text-[#1F7A4C] px-2 py-0.5 rounded-lg border border-neutral-200 hover:border-[#3BB578] transition cursor-pointer"
              >
                {preset.name} ({preset.margin}%)
              </button>
            ))}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChannel();
                  }
                }}
                placeholder="Ej: Mayorista B2B, Canal Web, Feria..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-neutral-600 block mb-1">
                Margen inicial (%):
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="any"
                  value={newChannelMargin}
                  onChange={(e) =>
                    setNewChannelMargin(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChannel();
                    }
                  }}
                  placeholder="100"
                  className="w-full pl-3 pr-7 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                />
                <span className="absolute right-2.5 text-xs font-bold text-neutral-400 pointer-events-none">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAddingChannel(false);
                setNewChannelName("");
              }}
              className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddChannel}
              disabled={!newChannelName.trim()}
              className="py-1.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Canal</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAddingChannel(true)}
          className="w-full py-2.5 px-3 bg-white hover:bg-[#DCF4D7]/40 text-[#1F7A4C] border-2 border-dashed border-[#3BB578]/50 hover:border-[#3BB578] rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Agregar canal de venta</span>
        </button>
      )}
    </div>
  );
}
