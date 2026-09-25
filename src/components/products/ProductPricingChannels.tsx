"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  TrendingUp,
  SlidersHorizontal,
  Pencil,
  Trash2,
  Plus,
  Tag,
  Store,
  Users,
  Truck,
  Globe,
  Sparkles,
  ChevronRight,
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
  batchTotalCost,
  yieldQuantity = 1,
  title = "Precios por Canal de Venta",
  subtitle = "Slider de margen %, precio sugerido y ganancia neta en mano",
  showExplanationBanner = false,
  className = "",
}: ProductPricingChannelsProps) {
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelMargin, setNewChannelMargin] = useState<number | string>(100);
  const [showChannelInfo, setShowChannelInfo] = useState(false);

  // Sincronizar precios de venta cuando el costo unitario cambia
  const prevUnitCostRef = useRef<number>(unitCost);
  const channelsRef = useRef<ChannelPriceItem[]>(channels);
  channelsRef.current = channels;

  useEffect(() => {
    if (prevUnitCostRef.current !== unitCost) {
      prevUnitCostRef.current = unitCost;
      const safeCost = Math.max(0, unitCost);
      onChange(
        channelsRef.current.map((ch) => {
          const marginNum =
            typeof ch.profit_margin_percent === "number"
              ? ch.profit_margin_percent
              : parseFloat(String(ch.profit_margin_percent)) || 0;
          return {
            ...ch,
            selling_price: Math.round(safeCost * (1 + marginNum / 100)),
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
    const marginNum = typeof marginVal === "number" ? marginVal : parseFloat(String(marginVal)) || 0;
    const safeCost = Math.max(0, unitCost);
    const newPrice = Math.round(safeCost * (1 + marginNum / 100));
    updated[index] = {
      ...updated[index],
      profit_margin_percent: marginVal,
      selling_price: newPrice,
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
    const priceNum = typeof priceVal === "number" ? priceVal : parseFloat(String(priceVal)) || 0;
    const safeCost = Math.max(0, unitCost);
    let newMargin = 0;
    if (safeCost > 0) {
      newMargin = Math.round(((priceNum - safeCost) / safeCost) * 100);
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
    const marginNum =
      typeof newChannelMargin === "number"
        ? newChannelMargin
        : parseFloat(String(newChannelMargin)) || 0;
    const safeCost = Math.max(0, unitCost);
    const calculatedPrice = Math.round(safeCost * (1 + marginNum / 100));

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
    const safeCost = Math.max(0, unitCost);
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

  const safeYield = yieldQuantity > 0 ? yieldQuantity : 1;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Encabezado de la Sección */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">{title}</h3>
            {subtitle && <p className="text-[11px] text-neutral-400">{subtitle}</p>}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-neutral-400 block font-medium">Costo Base Unitario</span>
          <span className="text-xs font-black text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-lg">
            {formatCurrency(unitCost)}
          </span>
        </div>
      </div>

      {/* Banner Didáctico Opcional */}
      {showExplanationBanner && (
        <div className="bg-[#F0FAF4] border border-[#DCF4D7] rounded-2xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setShowChannelInfo(!showChannelInfo)}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-[#DCF4D7]/30 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3 h-3" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[11px] text-[#1F7A4C]">
                  Costo Base Unitario: {formatCurrency(unitCost)}
                </span>
                {safeYield > 1 && batchTotalCost !== undefined && (
                  <span className="text-[10px] bg-white text-[#1F7A4C] px-2 py-0.5 rounded-full border border-[#DCF4D7] font-semibold">
                    Lote de {safeYield} u: {formatCurrency(batchTotalCost)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#1F7A4C] font-semibold bg-white/70 px-2 py-0.5 rounded-full border border-[#DCF4D7]">
              <span>{showChannelInfo ? "Ocultar" : "Ver explicación"}</span>
              <ChevronRight
                className={`w-3 h-3 transition-transform ${showChannelInfo ? "rotate-90" : ""}`}
              />
            </div>
          </button>
          {showChannelInfo && (
            <div className="px-3 pb-3 pt-0.5 text-[11px] leading-snug text-[#555] border-t border-[#DCF4D7]/60 animate-in fade-in duration-150">
              <p className="pt-2">
                Ajustá el slider del margen (%) o escribí directamente el precio de venta en pesos. HABA
                calcula al instante el <strong>precio sugerido</strong> y tu{" "}
                <strong>ganancia neta limpia</strong>.
              </p>
            </div>
          )}
        </div>
      )}

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
            const marginNum =
              typeof channel.profit_margin_percent === "number"
                ? channel.profit_margin_percent
                : parseFloat(String(channel.profit_margin_percent)) || 0;
            const profitAmount = channelSellingPrice - unitCost;
            const suggestedPrice = Math.round(unitCost * (1 + marginNum / 100));

            return (
              <div
                key={channel.id || idx}
                className="p-3.5 bg-white rounded-2xl border border-neutral-200 shadow-2xs space-y-3 hover:border-[#3BB578]/50 transition"
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

                {/* Slider de Margen % con Steppers y Input Numérico */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-neutral-200/80">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600">
                    <span className="flex items-center gap-1">
                      <SlidersHorizontal className="w-3 h-3 text-neutral-400" />
                      Margen de Ganancia:
                    </span>
                    <div className="flex items-center gap-1 bg-neutral-50 px-2 py-0.5 rounded-lg border border-neutral-200 focus-within:border-[#3BB578] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3BB578]/10 transition">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="1000"
                        value={channel.profit_margin_percent === "" ? "" : channel.profit_margin_percent}
                        onChange={(e) => handleMarginChange(idx, e.target.value)}
                        placeholder="0"
                        className="w-14 text-center text-xs font-bold outline-none text-[#1F7A4C] bg-transparent"
                        title="Ingresar porcentaje de margen manual"
                      />
                      <span className="text-xs font-bold text-neutral-400">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const current =
                          typeof channel.profit_margin_percent === "number"
                            ? channel.profit_margin_percent
                            : parseFloat(String(channel.profit_margin_percent)) || 0;
                        handleMarginChange(idx, Math.max(0, current - 5));
                      }}
                      className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 active:scale-95 border border-neutral-200 rounded-lg text-[11px] font-bold text-neutral-600 transition shadow-2xs select-none cursor-pointer"
                      title="Disminuir margen en 5%"
                    >
                      -5%
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="5"
                      value={channel.profit_margin_percent || 0}
                      onChange={(e) => handleMarginChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-full accent-[#3BB578] cursor-pointer h-2 bg-neutral-200 rounded-lg appearance-none touch-pan-x"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current =
                          typeof channel.profit_margin_percent === "number"
                            ? channel.profit_margin_percent
                            : parseFloat(String(channel.profit_margin_percent)) || 0;
                        handleMarginChange(idx, current + 5);
                      }}
                      className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 active:scale-95 border border-neutral-200 rounded-lg text-[11px] font-bold text-neutral-600 transition shadow-2xs select-none cursor-pointer"
                      title="Aumentar margen en 5%"
                    >
                      +5%
                    </button>
                  </div>
                </div>

                {/* Grid: Precio Sugerido y Precio de Lista Editable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-neutral-200/50">
                  <div className="bg-white p-2.5 rounded-xl border border-neutral-200 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-neutral-400 font-semibold">Precio Sugerido</span>
                      <span className="text-[9px] text-neutral-400">según margen</span>
                    </div>
                    <span className="text-sm font-bold text-neutral-700">
                      {formatCurrency(suggestedPrice)}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border-2 border-[#3BB578] shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-[#1F7A4C] font-bold flex items-center gap-1">
                        <Pencil className="w-2.5 h-2.5 text-[#1F7A4C]" />
                        <span>Precio de Lista ($)</span>
                      </label>
                      <span className="text-[9px] font-semibold bg-[#DCF4D7] text-[#1F7A4C] px-1.5 py-0.5 rounded">
                        Editable
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-xs font-black text-[#1F7A4C] pointer-events-none">
                        $
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={channel.selling_price === "" ? "" : channel.selling_price}
                        onChange={(e) => handlePriceChange(idx, e.target.value)}
                        placeholder="Establecer precio manual..."
                        className="w-full pl-6 pr-2 py-1 text-xs font-black text-[#1F7A4C] bg-neutral-50/60 hover:bg-neutral-50 focus:bg-white rounded-lg outline-none border border-transparent focus:border-[#3BB578] transition placeholder:text-neutral-300 placeholder:font-normal"
                      />
                    </div>
                    <span className="text-[9px] text-neutral-400 mt-1">
                      Podés escribir el precio directamente y el margen se recalcula.
                    </span>
                  </div>
                </div>

                {/* Desglose de Costo + Ganancia = Precio */}
                <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[10px] text-neutral-600 bg-white/80 px-2 py-1 rounded-xl font-medium">
                  <span>
                    Costo: <strong>{formatCurrency(unitCost)}</strong>
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
                    Precio: <strong className="text-[#2B2B2B]">{formatCurrency(channelSellingPrice)}</strong>
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
