/**
 * Utilidades de cálculo, vinculación de insumos fuente y propagación
 * en cascada de dependencias para la Calculadora de Costo de Impresión de HABA.
 */

export interface SourceConsumableInfo {
  id?: string;
  name: string;
  current_price: number;
  purchase_quantity: number;
  purchase_unit: string;
  use_unit?: string;
  conversion_factor?: number;
}

export interface TechnologyConsumableDef {
  id: string;
  name: string;
  referenceQuantity: number;
  unit: string;
}

export const TECHNOLOGY_CONSUMABLES: Record<string, TechnologyConsumableDef[]> = {
  tank4: [
    { id: "cyan", name: "Cian", referenceQuantity: 65, unit: "ml" },
    { id: "magenta", name: "Magenta", referenceQuantity: 65, unit: "ml" },
    { id: "yellow", name: "Amarillo", referenceQuantity: 65, unit: "ml" },
    { id: "black", name: "Negro", referenceQuantity: 65, unit: "ml" },
  ],
  tank6: [
    { id: "cyan", name: "Cian", referenceQuantity: 70, unit: "ml" },
    { id: "magenta", name: "Magenta", referenceQuantity: 70, unit: "ml" },
    { id: "yellow", name: "Amarillo", referenceQuantity: 70, unit: "ml" },
    { id: "photoBlack", name: "Negro fotográfico", referenceQuantity: 70, unit: "ml" },
    { id: "gray", name: "Gris", referenceQuantity: 70, unit: "ml" },
    { id: "pigmentBlack", name: "Negro pigmentado", referenceQuantity: 70, unit: "ml" },
  ],
  cartridge: [
    { id: "black", name: "Cartucho negro", referenceQuantity: 1, unit: "unidad" },
    { id: "color", name: "Cartucho color", referenceQuantity: 1, unit: "unidad" },
  ],
  sublimation: [
    { id: "cyan", name: "Cian", referenceQuantity: 100, unit: "ml" },
    { id: "magenta", name: "Magenta", referenceQuantity: 100, unit: "ml" },
    { id: "yellow", name: "Amarillo", referenceQuantity: 100, unit: "ml" },
    { id: "black", name: "Negro", referenceQuantity: 100, unit: "ml" },
  ],
  laserMono: [
    { id: "black", name: "Tóner negro", referenceQuantity: 1, unit: "tóner" },
  ],
  laserColor: [
    { id: "cyan", name: "Cian", referenceQuantity: 1, unit: "tóner" },
    { id: "magenta", name: "Magenta", referenceQuantity: 1, unit: "tóner" },
    { id: "yellow", name: "Amarillo", referenceQuantity: 1, unit: "tóner" },
    { id: "black", name: "Negro", referenceQuantity: 1, unit: "tóner" },
  ],
};

/**
 * Normaliza nombres para coincidencias flexibles de insumos de impresión.
 */
function cleanName(n: string): string {
  return (n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Genera el nombre por defecto adecuado para dar de alta una tinta/tóner en HABA.
 */
export function getDefaultSourceSupplyName(
  consumableId: string,
  consumableName: string,
  technologyId: string
): string {
  const cName = consumableName || consumableId;
  if (technologyId === "laserMono" || technologyId === "laserColor") {
    if (cleanName(cName).includes("toner")) return cName;
    return `Tóner ${cName}`;
  }
  if (technologyId === "cartridge") {
    if (cleanName(cName).includes("cartucho")) return cName;
    return `Cartucho ${cName}`;
  }
  if (technologyId === "sublimation") {
    if (cleanName(cName).includes("sublimac")) return cName;
    return `Tinta Sublimación ${cName}`;
  }
  if (cleanName(cName).includes("tinta")) return cName;
  return `Tinta ${cName}`;
}

/**
 * Vincula los insumos existentes en HABA con los consumibles de una tecnología.
 * 1) Revisa mapeo previo guardado en localStorage.
 * 2) Busca coincidencias heurísticas por nombre de consumible (Cian, Magenta, Amarillo, etc.).
 */
export function matchSourceInsumos(
  existingSupplies: Array<{
    id?: string;
    name: string;
    current_price?: number;
    purchase_quantity?: number;
    purchase_unit?: string;
  }>,
  technologyId: string
): {
  sourceInsumoIdsByConfigId: Record<string, string>;
  sourceSuppliesByConfigId: Record<string, {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
  }>;
} {
  const sourceInsumoIdsByConfigId: Record<string, string> = {};
  const sourceSuppliesByConfigId: Record<string, {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
  }> = {};

  const defs = TECHNOLOGY_CONSUMABLES[technologyId] || [];

  // 1. Mapeo previamente persistido en localStorage
  let savedMap: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`haba_printing_sources_${technologyId}`);
      if (raw) savedMap = JSON.parse(raw);
    } catch {}
  }

  // 2. Asociar IDs directos si existen en la lista de insumos de HABA
  for (const def of defs) {
    const savedId = savedMap[def.id];
    if (savedId) {
      const found = existingSupplies.find((s) => s.id === savedId);
      if (found && found.id) {
        sourceInsumoIdsByConfigId[def.id] = found.id;
        sourceSuppliesByConfigId[def.id] = {
          id: found.id,
          name: found.name,
          price: Number(found.current_price) || 0,
          quantity: Number(found.purchase_quantity) || 1,
          unit: found.purchase_unit || def.unit,
        };
      }
    }
  }

  // 3. Para los consumibles aún no asociados, buscar por nombre inteligente
  for (const def of defs) {
    if (sourceInsumoIdsByConfigId[def.id]) continue;

    const matched = existingSupplies.find((supply) => {
      if (!supply || !supply.name) return false;
      const sName = cleanName(supply.name);

      switch (def.id) {
        case "cyan": {
          const isSublimation = sName.includes("sublimac");
          const isLaser = sName.includes("toner") || sName.includes("laser");
          const isCartridge = sName.includes("cartucho");
          if (technologyId === "sublimation") return isSublimation && (sName.includes("cian") || sName.includes("cyan"));
          if (technologyId === "laserColor") return isLaser && (sName.includes("cian") || sName.includes("cyan"));
          return (sName.includes("cian") || sName.includes("cyan")) && !isSublimation && !isLaser && !isCartridge;
        }
        case "magenta": {
          const isSublimation = sName.includes("sublimac");
          const isLaser = sName.includes("toner") || sName.includes("laser");
          const isCartridge = sName.includes("cartucho");
          if (technologyId === "sublimation") return isSublimation && sName.includes("magenta");
          if (technologyId === "laserColor") return isLaser && sName.includes("magenta");
          return sName.includes("magenta") && !isSublimation && !isLaser && !isCartridge;
        }
        case "yellow": {
          const isSublimation = sName.includes("sublimac");
          const isLaser = sName.includes("toner") || sName.includes("laser");
          const isCartridge = sName.includes("cartucho");
          if (technologyId === "sublimation") return isSublimation && (sName.includes("amarill") || sName.includes("yellow"));
          if (technologyId === "laserColor") return isLaser && (sName.includes("amarill") || sName.includes("yellow"));
          return (sName.includes("amarill") || sName.includes("yellow")) && !isSublimation && !isLaser && !isCartridge;
        }
        case "black": {
          const isSublimation = sName.includes("sublimac");
          const isLaser = sName.includes("toner") || sName.includes("laser");
          const isCartridge = sName.includes("cartucho");
          if (technologyId === "laserMono" || technologyId === "laserColor") {
            return isLaser && sName.includes("negr");
          }
          if (technologyId === "cartridge") {
            return isCartridge && sName.includes("negr");
          }
          if (technologyId === "sublimation") {
            return isSublimation && sName.includes("negr");
          }
          return sName.includes("negr") && !sName.includes("fotogr") && !sName.includes("pigment") && !isSublimation && !isLaser && !isCartridge;
        }
        case "photoBlack":
          return sName.includes("fotogr") || sName.includes("photo black");
        case "gray":
          return sName.includes("gris") || sName.includes("gray");
        case "pigmentBlack":
          return sName.includes("pigment");
        case "color":
          return sName.includes("color") || sName.includes("tricolor");
        default:
          return sName.includes(cleanName(def.name));
      }
    });

    if (matched && matched.id) {
      sourceInsumoIdsByConfigId[def.id] = matched.id;
      sourceSuppliesByConfigId[def.id] = {
        id: matched.id,
        name: matched.name,
        price: Number(matched.current_price) || 0,
        quantity: Number(matched.purchase_quantity) || 1,
        unit: matched.purchase_unit || def.unit,
      };
    }
  }

  return { sourceInsumoIdsByConfigId, sourceSuppliesByConfigId };
}

/**
 * Convierte cantidades de líquidos a unidad base (ml).
 */
function unitToBase(quantity: number, unit: string): number {
  if (unit === "L" || unit === "l") return quantity * 1000;
  return quantity;
}

/**
 * Recalcula matemáticamente el costo de reposición (`replacementCost`) de un insumo derivado de impresión
 * a partir de los precios actualizados de sus consumibles fuente.
 */
export function recalculateDerivedPrintingCost(
  derivedPayload: any,
  sourcePricesMap: Record<string, number>
): {
  newCost: number;
  hasPriceChange: boolean;
  updatedPayload: any;
} {
  if (!derivedPayload || !derivedPayload.calculation || !derivedPayload.sourceConsumables) {
    return {
      newCost: derivedPayload?.replacementCost || 0,
      hasPriceChange: false,
      updatedPayload: derivedPayload,
    };
  }

  const updatedPayload = JSON.parse(JSON.stringify(derivedPayload));
  const isSingle =
    updatedPayload.technology?.id === "cartridge" ||
    updatedPayload.technology?.id === "laserMono" ||
    updatedPayload.technology?.id === "laserColor";

  let totalReferenceLoad = 0;
  let priceModified = false;

  const updatedLines = updatedPayload.sourceConsumables.map((line: any) => {
    const sourceId = line.sourceInsumoId;
    let price = Number(line.purchasePrice) || 0;

    if (sourceId && sourcePricesMap[sourceId] !== undefined) {
      const updatedPrice = Number(sourcePricesMap[sourceId]);
      if (Math.abs(updatedPrice - price) > 0.0001) {
        price = updatedPrice;
        line.purchasePrice = updatedPrice;
        priceModified = true;
      }
    }

    const refQty = Number(line.habaReferenceQuantity) || Number(line.quantityPurchased) || 1;
    let costPerBaseUnit = 0;
    let referenceCost = 0;

    if (isSingle) {
      costPerBaseUnit = price;
      referenceCost = costPerBaseUnit * refQty;
    } else {
      const qtyBase = unitToBase(Number(line.quantityPurchased) || 1, line.purchaseUnit || "ml");
      costPerBaseUnit = qtyBase > 0 ? price / qtyBase : 0;
      referenceCost = costPerBaseUnit * refQty;
    }

    line.costPerBaseUnit = Number(costPerBaseUnit.toFixed(6));
    line.referenceCost = Number(referenceCost.toFixed(6));
    totalReferenceLoad += referenceCost;

    return line;
  });

  updatedPayload.sourceConsumables = updatedLines;

  const refYield = Number(updatedPayload.calculation.referenceYield) || 4000;
  const base5A4Simple = refYield > 0 ? totalReferenceLoad / refYield : 0;
  const printMultiplier = Number(updatedPayload.calculation.printMultiplier) || 1;
  const base5 = base5A4Simple * printMultiplier;
  const coverageMultiplier = Number(updatedPayload.printConfiguration?.coverageMultiplier) || 1;
  const newCost = Number((base5 * coverageMultiplier).toFixed(6));

  updatedPayload.calculation.referenceLoadCost = Number(totalReferenceLoad.toFixed(6));
  updatedPayload.calculation.baseCost5 = Number(base5.toFixed(6));
  updatedPayload.calculation.selectedCostPerPrint = newCost;
  updatedPayload.replacementCost = newCost;

  const previousCost = Number(derivedPayload.replacementCost) || 0;
  const costDiff = Math.abs(newCost - previousCost);

  return {
    newCost,
    hasPriceChange: costDiff > 0.0001 || priceModified,
    updatedPayload,
  };
}

/**
 * Propaga en cascada el recálculo a todos los insumos derivados guardados en HABA
 * cuyas fuentes de tintas/tóneres hayan sido actualizadas.
 * Actualiza la tabla `supplies`, inserta en `supply_price_history` y refresca `localStorage`.
 */
export async function recalculateAndPropagatePrintingDependencies(
  supabase: any,
  updatedSourceSupplies: Array<{ id: string; price: number }>
): Promise<Array<{ id: string; name: string; oldPrice: number; newPrice: number }>> {
  if (!updatedSourceSupplies || updatedSourceSupplies.length === 0) {
    return [];
  }

  const updatedSourcesMap: Record<string, number> = {};
  const updatedIdsSet = new Set<string>();
  for (const s of updatedSourceSupplies) {
    if (s.id) {
      updatedSourcesMap[s.id] = Number(s.price);
      updatedIdsSet.add(s.id);
    }
  }

  const results: Array<{ id: string; name: string; oldPrice: number; newPrice: number }> = [];

  if (typeof window === "undefined") {
    return results;
  }

  try {
    const listRaw = localStorage.getItem("haba-printing-derived-insumos");
    if (!listRaw) return results;

    const derivedList: any[] = JSON.parse(listRaw);
    if (!Array.isArray(derivedList) || derivedList.length === 0) return results;

    const nowIso = new Date().toISOString();
    let anyListModified = false;

    for (let i = 0; i < derivedList.length; i++) {
      const item = derivedList[i];
      if (!item || !item.id) continue;

      const sourceIds: string[] = item.dependency?.sourceInsumoIds || [];
      const isAffected = sourceIds.some((id) => updatedIdsSet.has(id));

      if (!isAffected) continue;

      const oldPrice = Number(item.replacementCost) || 0;
      const { newCost, hasPriceChange, updatedPayload } = recalculateDerivedPrintingCost(
        item,
        updatedSourcesMap
      );

      if (hasPriceChange && Math.abs(newCost - oldPrice) > 0.0001) {
        // 1. Actualizar el precio vigente en Supabase
        const { error: updateError } = await supabase
          .from("supplies")
          .update({
            current_price: newCost,
            updated_at: nowIso,
          })
          .eq("id", item.id);

        if (updateError) {
          console.warn(`Error al actualizar insumo derivado ${item.id}:`, updateError);
          continue;
        }

        // 2. Registrar en supply_price_history para activar alertas de productos
        await supabase.from("supply_price_history").insert({
          supply_id: item.id,
          price: newCost,
          changed_at: nowIso,
        });

        // 3. Persistir metadatos actualizados en localStorage
        localStorage.setItem(`haba_printing_supply_${item.id}`, JSON.stringify(updatedPayload));
        derivedList[i] = { id: item.id, ...updatedPayload };
        anyListModified = true;

        results.push({
          id: item.id,
          name: item.name,
          oldPrice,
          newPrice: newCost,
        });

        // 4. Buscar productos que utilicen este insumo derivado para activar alerta de revisión
        try {
          const { data: psAffected } = await supabase
            .from("product_supplies")
            .select("product_id")
            .eq("supply_id", item.id);

          if (psAffected && psAffected.length > 0) {
            const productIds = psAffected.map((p: any) => p.product_id).filter(Boolean);
            if (productIds.length > 0) {
              await supabase
                .from("products")
                .update({ needs_price_review: true, updated_at: nowIso })
                .in("id", productIds);
            }
          }
        } catch (psErr) {
          console.warn("Aviso al marcar productos afectados por insumo derivado:", psErr);
        }
      }
    }

    if (anyListModified) {
      localStorage.setItem("haba-printing-derived-insumos", JSON.stringify(derivedList));
    }

    // 5. Marcar productos que usen directamente las tintas/tóneres fuente actualizadas
    if (updatedIdsSet.size > 0) {
      try {
        const { data: directPs } = await supabase
          .from("product_supplies")
          .select("product_id")
          .in("supply_id", Array.from(updatedIdsSet));

        if (directPs && directPs.length > 0) {
          const directIds = directPs.map((p: any) => p.product_id).filter(Boolean);
          if (directIds.length > 0) {
            await supabase
              .from("products")
              .update({ needs_price_review: true, updated_at: nowIso })
              .in("id", directIds);
          }
        }
      } catch (directErr) {
        console.warn("Aviso al marcar productos afectados por insumos base:", directErr);
      }
    }

    // 6. Notificar a la interfaz de HABA de forma reactiva
    if (results.length > 0 || updatedSourceSupplies.length > 0) {
      window.dispatchEvent(new CustomEvent("haba-supplies-updated"));
      window.dispatchEvent(new CustomEvent("haba-products-updated"));
      window.dispatchEvent(new CustomEvent("haba-notifications-updated"));
    }
  } catch (err) {
    console.error("Error en recalculateAndPropagatePrintingDependencies:", err);
  }

  return results;
}
