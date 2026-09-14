export type PlanType = "prueba" | "mensual" | "trimestral" | "anual";
export type PlanStatus = "vigente" | "proximo_a_vencer" | "vencido";
export type AccountStatus = "active" | "suspended" | "deactivated";

export interface PlanStatusInfo {
  status: PlanStatus;
  remainingDays: number;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  rowText: string;
}

export const PLAN_NAMES: Record<PlanType, string> = {
  prueba: "Prueba",
  mensual: "Mensual",
  trimestral: "Trimestral",
  anual: "Anual",
};

export const ACCOUNT_STATUS_NAMES: Record<AccountStatus, string> = {
  active: "Activa",
  suspended: "Suspendida",
  deactivated: "Desactivada",
};

/**
 * Calcula la fecha de fin de plan automáticamente según la fecha de inicio y el tipo de plan
 * @param startDateStr Fecha en formato YYYY-MM-DD o ISO
 * @param planType 'prueba' | 'mensual' | 'trimestral' | 'anual'
 * @returns Fecha en formato YYYY-MM-DD
 */
export function calculatePlanEndDate(
  startDateStr: string | null | undefined,
  planType: PlanType = "prueba"
): string {
  const baseDate = startDateStr ? new Date(startDateStr) : new Date();
  if (isNaN(baseDate.getTime())) {
    return new Date().toISOString().split("T")[0];
  }

  const result = new Date(baseDate.getTime());

  switch (planType) {
    case "prueba":
      // Prueba estándar: 15 días
      result.setDate(result.getDate() + 15);
      break;
    case "mensual":
      // 1 mes calendario
      result.setMonth(result.getMonth() + 1);
      break;
    case "trimestral":
      // 3 meses calendario
      result.setMonth(result.getMonth() + 3);
      break;
    case "anual":
      // 1 año calendario
      result.setFullYear(result.getFullYear() + 1);
      break;
    default:
      result.setDate(result.getDate() + 15);
  }

  return result.toISOString().split("T")[0];
}

/**
 * Determina el estado del plan (Vigente, Próximo a vencer, Vencido) y los días restantes
 */
export function getPlanStatusInfo(endDateStr: string | null | undefined): PlanStatusInfo {
  if (!endDateStr) {
    return {
      status: "vigente",
      remainingDays: 0,
      label: "Sin fecha",
      badgeBg: "bg-neutral-100",
      badgeText: "text-neutral-600",
      badgeBorder: "border-neutral-200",
      rowText: "Sin fecha configurada",
    };
  }

  // Normalizar fechas a medianoche local
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Asegurar parsing seguro de YYYY-MM-DD
  const parts = endDateStr.split("T")[0].split("-");
  const end = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
    0,
    0,
    0,
    0
  );

  const diffMs = end.getTime() - now.getTime();
  const remainingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (remainingDays < 0) {
    const expiredDays = Math.abs(remainingDays);
    return {
      status: "vencido",
      remainingDays,
      label: "Vencido",
      badgeBg: "bg-rose-100",
      badgeText: "text-rose-700",
      badgeBorder: "border-rose-200",
      rowText: `Venció hace ${expiredDays} ${expiredDays === 1 ? "día" : "días"}`,
    };
  }

  if (remainingDays <= 5) {
    return {
      status: "proximo_a_vencer",
      remainingDays,
      label: "Próximo a vencer",
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-800",
      badgeBorder: "border-amber-200",
      rowText: `Restan ${remainingDays} ${remainingDays === 1 ? "día" : "días"}`,
    };
  }

  return {
    status: "vigente",
    remainingDays,
    label: "Vigente",
    badgeBg: "bg-[#DCF4D7]",
    badgeText: "text-[#1F7A4C]",
    badgeBorder: "border-[#C3EBC0]",
    rowText: `Restan ${remainingDays} días`,
  };
}

/**
 * Formatea una fecha YYYY-MM-DD o ISO a formato legible DD/MM/AAAA
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const cleanDate = dateStr.split("T")[0];
    const [year, month, day] = cleanDate.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  } catch {
    return dateStr;
  }
}
