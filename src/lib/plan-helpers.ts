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

export interface InitialUserMetadata {
  plan_type: PlanType;
  plan_start_date: string;
  plan_end_date: string;
  account_status: AccountStatus;
  is_new: boolean;
  registration_source: "public" | "admin";
  terms_version?: string | null;
  terms_accepted_at?: string | null;
}

/**
 * Genera la metadata inicial para la creación de un nuevo usuario en HABA (T5).
 * Reutilizada tanto en el alta manual desde /admin como en el registro público /registro.
 * Asigna por defecto:
 * - plan_type = "prueba"
 * - plan_start_date = hoy (ISO YYYY-MM-DD)
 * - plan_end_date = 15 días posteriores
 * - account_status = "active"
 * - is_new = true
 */
export function buildInitialUserMetadata(options?: {
  planType?: PlanType;
  planStartDate?: string;
  planEndDate?: string;
  accountStatus?: AccountStatus;
  isNew?: boolean;
  registrationSource?: "public" | "admin";
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
}): InitialUserMetadata {
  const planType: PlanType = options?.planType || "prueba";
  const startDate =
    options?.planStartDate?.trim() || new Date().toISOString().split("T")[0];
  const endDate =
    options?.planEndDate?.trim() || calculatePlanEndDate(startDate, planType);
  const accountStatus: AccountStatus = options?.accountStatus || "active";
  const isNew = options?.isNew !== undefined ? options.isNew : true;
  const registrationSource = options?.registrationSource || "public";

  return {
    plan_type: planType,
    plan_start_date: startDate,
    plan_end_date: endDate,
    account_status: accountStatus,
    is_new: isNew,
    registration_source: registrationSource,
    ...(options?.termsVersion ? { terms_version: options.termsVersion } : {}),
    ...(options?.termsAcceptedAt ? { terms_accepted_at: options.termsAcceptedAt } : {}),
  };
}

/**
 * Determina si un plan se encuentra vencido según su fecha de fin y estado de cuenta (T6).
 */
export function isPlanExpired(
  endDateStr: string | null | undefined,
  accountStatus?: AccountStatus | string | null
): boolean {
  if (accountStatus === "suspended" || accountStatus === "deactivated") {
    return true;
  }
  if (!endDateStr) {
    return false;
  }
  const statusInfo = getPlanStatusInfo(endDateStr);
  return statusInfo.status === "vencido";
}

/**
 * Determina si faltan N días o menos para el vencimiento del plan (pre-vencimiento preventivo T6).
 * Por defecto thresholdDays = 3 (3 días o menos).
 */
export function isPlanExpiringSoon(
  endDateStr: string | null | undefined,
  thresholdDays: number = 3
): { isExpiringSoon: boolean; remainingDays: number } {
  if (!endDateStr) {
    return { isExpiringSoon: false, remainingDays: 0 };
  }
  const statusInfo = getPlanStatusInfo(endDateStr);
  if (statusInfo.status === "vencido") {
    return { isExpiringSoon: false, remainingDays: statusInfo.remainingDays };
  }
  const isExpiringSoon =
    statusInfo.remainingDays >= 0 && statusInfo.remainingDays <= thresholdDays;
  return { isExpiringSoon, remainingDays: statusInfo.remainingDays };
}

/**
 * Obtiene el link de suscripción / pago configurado para Mercado Pago (T6).
 */
export function getSubscriptionUrl(): string {
  return process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_URL || "";
}

/**
 * SEGURIDAD — datos del plan confiables.
 *
 * user_metadata puede ser editado por la propia usuaria desde el navegador
 * (supabase.auth.updateUser), por lo que NUNCA debe usarse para decidir acceso o pagos.
 * Los datos del plan viven en app_metadata, que solo puede escribir el servidor
 * con la service role (panel de admin, webhook de Mercado Pago, registro).
 *
 * Si una cuenta no tiene datos del plan en app_metadata (por ejemplo, alguien que llamó
 * a la API de registro de Supabase directamente), se asume una prueba de 15 días
 * contada desde created_at, que también es un dato del servidor.
 */
export const TRUSTED_PLAN_KEYS = [
  "plan_type",
  "plan_start_date",
  "plan_end_date",
  "account_status",
  "mp_status",
  "mp_preapproval_id",
] as const;

export interface TrustedPlanMeta {
  plan_type: PlanType;
  plan_start_date: string;
  plan_end_date: string;
  account_status: AccountStatus;
  mp_status: string | null;
  mp_preapproval_id: string | null;
}

interface UserWithAppMetadata {
  created_at?: string | null;
  app_metadata?: Record<string, any> | null;
}

export function getTrustedPlanMeta(user: UserWithAppMetadata | null | undefined): TrustedPlanMeta {
  const app = user?.app_metadata || {};
  const createdDate =
    (user?.created_at || "").split("T")[0] || new Date().toISOString().split("T")[0];

  const planType: PlanType = app.plan_type || "prueba";
  const planStart: string = app.plan_start_date || createdDate;
  const planEnd: string = app.plan_end_date || calculatePlanEndDate(planStart, planType);

  return {
    plan_type: planType,
    plan_start_date: planStart,
    plan_end_date: planEnd,
    account_status: (app.account_status as AccountStatus) || "active",
    mp_status: app.mp_status || null,
    mp_preapproval_id: app.mp_preapproval_id || null,
  };
}

/** Separa un objeto en { app: claves del plan (confiables), user: el resto }. */
export function splitPlanMetadata(input: Record<string, any>): {
  app: Record<string, any>;
  user: Record<string, any>;
} {
  const app: Record<string, any> = {};
  const user: Record<string, any> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if ((TRUSTED_PLAN_KEYS as readonly string[]).includes(key)) app[key] = value;
    else user[key] = value;
  }
  return { app, user };
}

