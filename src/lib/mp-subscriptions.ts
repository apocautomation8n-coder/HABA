/**
 * Suscripción mensual con renovación automática (Mercado Pago, plan asociado).
 *
 * Cada usuaria tiene SU suscripción, creada por HABA y asociada al único plan "Haba Mensual",
 * con external_reference = id de la cuenta de HABA. Así cada cobro y cada baja llegan con el id
 * y no hay que adivinar de quién son (el link compartido del plan descarta ese dato).
 *
 * La tarjeta se carga en el formulario seguro de Mercado Pago (cardForm): HABA solo recibe un
 * token de un solo uso (card_token_id) y nunca ve los datos de la tarjeta.
 *
 * Se usa solo en el servidor (usa MP_ACCESS_TOKEN y la service role de Supabase).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  addDaysToDate,
  applyApprovedPaymentToUser,
  getExpectedPlanAmount,
  SUBSCRIPTION_GRACE_DAYS,
} from "@/lib/mercadopago";

const MP_API = "https://api.mercadopago.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isHabaUserId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function getAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Usuaria autenticada: Bearer de Supabase o sesión por cookies. */
export async function getRequestUser(request: Request): Promise<any | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await getAdminClient().auth.getUser(authHeader.substring(7));
    if (data?.user) return data.user;
  }
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

function mpHeaders(extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

/** Plan único "Haba Mensual": MP_PREAPPROVAL_PLAN_ID o, si falta, el único plan activo de la cuenta. */
export async function resolvePlanId(): Promise<string | null> {
  const fromEnv = (process.env.MP_PREAPPROVAL_PLAN_ID || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const res = await fetch(`${MP_API}/preapproval_plan/search?status=active`, { headers: mpHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const plans = Array.isArray(data.results) ? data.results : [];
    const haba = plans.filter((p: any) => /haba/i.test(p.reason || ""));
    if (haba.length === 1) return haba[0].id;
    if (plans.length === 1) return plans[0].id;
    console.error(
      `[Suscripción MP] No se pudo elegir el plan: hay ${plans.length} planes activos. Configurá MP_PREAPPROVAL_PLAN_ID.`
    );
  } catch (err) {
    console.error("[Suscripción MP] Error buscando el plan activo:", err);
  }
  return null;
}

export async function getPreapproval(preapprovalId: string): Promise<any | null> {
  if (!preapprovalId) return null;
  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`, { headers: mpHeaders() });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Suscripción vigente de la usuaria, verificada contra Mercado Pago: solo cuenta si la suscripción
 * guardada existe y su external_reference es el id de esta cuenta (descarta ids mal guardados).
 */
export async function getUserSubscription(user: any): Promise<any | null> {
  const preapprovalId = String(user?.app_metadata?.mp_preapproval_id || "").trim();
  if (!preapprovalId) return null;
  const pre = await getPreapproval(preapprovalId);
  if (!pre) return null;
  // Las del link del plan no traen el id de la cuenta: valen porque el id lo guardó el servidor.
  // Se descarta solo si pertenece explícitamente a otra cuenta.
  const ref = String(pre.external_reference || "").trim();
  if (ref !== user.id && isHabaUserId(ref)) return null;
  return pre;
}

/** Ids de los pagos ya acreditados a la cuenta, del más reciente al más viejo. */
function appliedPaymentIdsOf(authUser: any, profile: any): string[] {
  const ids: string[] = [];
  const push = (v: unknown) => {
    const s = String(v || "").trim();
    if (/^\d+$/.test(s) && !ids.includes(s)) ids.push(s);
  };
  push(authUser?.app_metadata?.last_payment_id);
  push(profile?.last_payment_id);
  const list = Array.isArray(authUser?.app_metadata?.applied_payment_ids) ? authUser.app_metadata.applied_payment_ids : [];
  for (const id of [...list].reverse()) push(id);
  return ids;
}

/**
 * Vincula la suscripción de la cuenta a partir de un pago ya acreditado: el pago de Mercado Pago
 * dice a qué suscripción pertenece (transaction_data.subscription_id). Es la forma segura de
 * vincular las suscripciones del link del plan, que no traen el id de la cuenta.
 */
export async function linkSubscriptionFromAppliedPayments(userId: string): Promise<any | null> {
  const admin = getAdminClient();
  const { data: authRes } = await admin.auth.admin.getUserById(userId);
  const authUser = authRes?.user;
  if (!authUser) return null;
  const { data: profile } = await admin.from("profiles").select("id, last_payment_id").eq("id", userId).maybeSingle();
  const paymentIds = appliedPaymentIdsOf(authUser, profile).slice(0, 3);
  for (const paymentId of paymentIds) {
    try {
      const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: mpHeaders() });
      if (!res.ok) continue;
      const payment = await res.json();
      const subId = String(
        payment?.point_of_interaction?.transaction_data?.subscription_id || payment?.metadata?.preapproval_id || ""
      ).trim();
      if (!subId) continue;
      const pre = await getPreapproval(subId);
      if (!pre) continue;
      const ref = String(pre.external_reference || "").trim();
      if (ref !== userId && isHabaUserId(ref)) continue;
      const owner = await findUserIdBySavedPreapproval(subId);
      if (owner && owner !== userId) continue;
      await saveSubscriptionState(userId, {
        preapprovalId: String(pre.id),
        status: pre.status,
        payerEmail: pre.payer_email || payment?.payer?.email || null,
        nextPaymentDate: pre.next_payment_date || null,
      });
      return pre;
    } catch (err) {
      console.warn("[Suscripción MP] No se pudo vincular por el pago", paymentId, err);
    }
  }
  return null;
}

/**
 * Email de pago (y último pago) por suscripción, a partir de los pagos recientes de la cuenta de
 * Mercado Pago. Cada pago de suscripción trae el id de la suscripción y el email del pagador.
 */
async function payerEmailBySubscriptionFromRecentPayments(): Promise<Map<string, { email: string; paymentId: string }>> {
  const map = new Map<string, { email: string; paymentId: string }>();
  const PAGE = 100;
  for (let offset = 0, page = 0; page < 5; page++, offset += PAGE) {
    const res = await fetch(
      `${MP_API}/v1/payments/search?sort=date_created&criteria=desc&limit=${PAGE}&offset=${offset}`,
      { headers: mpHeaders() }
    );
    if (!res.ok) break;
    const data = await res.json().catch(() => ({}));
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    for (const p of results) {
      if (p?.status !== "approved") continue;
      const subId = String(
        p?.point_of_interaction?.transaction_data?.subscription_id || p?.metadata?.preapproval_id || ""
      ).trim();
      const email = String(p?.payer?.email || p?.additional_info?.payer?.email || "").trim().toLowerCase();
      if (subId && email && !map.has(subId)) map.set(subId, { email, paymentId: String(p.id) });
    }
    if (results.length < PAGE) break;
  }
  return map;
}

export interface SubscriptionReportRow {
  suscripcion: string;
  estado: string;
  /** green: al día · yellow: último cobro rechazado (MP reintenta) · red: sin cobros */
  semaforo: string;
  pagador: string;
  alta: string;
  ultimoCobroFecha: string;
  ultimoCobroMonto: number | null;
  cobrosAprobados: number | null;
  proximoCobro: string;
  cuentaNumero: string;
  cuentaNombre: string;
  cuentaEmail: string;
  cuentaPlan: string;
  cuentaVence: string;
  observacion: string;
}

export interface SubscriptionsReport {
  generadoEl: string;
  filas: SubscriptionReportRow[];
  /** Cuentas con plan mensual que no tienen ninguna suscripción activa asociada */
  cuentasSinSuscripcion: { numero: string; nombre: string; email: string; vence: string }[];
}

/**
 * Cruce de las suscripciones del plan en Mercado Pago con las cuentas de HABA: estado, último
 * cobro (aprobado o rechazado), próximo cobro y a qué cuenta corresponde cada una. Es lo que
 * Mercado Pago no deja exportar desde el menú de suscripciones.
 */
export async function buildSubscriptionsReport(): Promise<SubscriptionsReport> {
  const admin = getAdminClient();
  const planId = await resolvePlanId();
  const subsRaw = planId ? await searchPreapprovals(`preapproval_plan_id=${encodeURIComponent(planId)}`) : [];
  const subs = [...new Map(subsRaw.filter((s) => s?.id).map((s) => [String(s.id), s])).values()];

  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users: any[] = data?.users || [];
  const { data: profileRows } = await admin.from("profiles").select("*");
  const profiles = new Map<string, any>((profileRows || []).map((r: any) => [String(r.id), r]));

  const accountBySub = new Map<string, any>();
  for (const u of users) {
    const prof = profiles.get(String(u.id));
    const id = String(u.app_metadata?.mp_preapproval_id || prof?.mp_preapproval_id || "").trim();
    if (id && !accountBySub.has(id)) accountBySub.set(id, u);
  }
  const accountOf = (u: any) => {
    const prof = profiles.get(String(u.id)) || {};
    const meta = u.app_metadata || {};
    const um = u.user_metadata || {};
    return {
      numero: String(um.account_number || prof.account_number || ""),
      nombre: String(prof.full_name || um.full_name || prof.business_name || um.business_name || ""),
      email: String(u.email || prof.email || ""),
      plan: String(meta.plan_type || prof.plan_type || ""),
      vence: String(meta.plan_end_date || prof.plan_end_date || "").split("T")[0],
    };
  };

  const dateOnly = (v: unknown) => String(v || "").split("T")[0];
  const activeByUser = new Map<string, number>();
  for (const s of subs) {
    if (s?.status !== "authorized") continue;
    const u = accountBySub.get(String(s.id));
    if (u) activeByUser.set(String(u.id), (activeByUser.get(String(u.id)) || 0) + 1);
  }

  const filas: SubscriptionReportRow[] = subs.map((s) => {
    const u = accountBySub.get(String(s.id));
    const acc = u ? accountOf(u) : null;
    const sem = String(s?.summarized?.semaphore || "");
    const obs: string[] = [];
    if (s.status === "authorized" && sem === "yellow") obs.push("Último cobro rechazado: Mercado Pago reintenta");
    if (s.status === "authorized" && sem === "red") obs.push("Sin cobros aprobados");
    if (s.status === "paused") obs.push("Pausada por Mercado Pago (cobros rechazados)");
    if (s.status === "cancelled") obs.push("Cancelada");
    if (!acc && s.status === "authorized") obs.push("Sin cuenta de HABA vinculada");
    if (u && (activeByUser.get(String(u.id)) || 0) > 1 && s.status === "authorized") obs.push("La cuenta tiene más de una suscripción activa");
    return {
      suscripcion: String(s.id),
      estado: String(s.status || ""),
      semaforo: sem,
      pagador: `${s?.payer_first_name || ""} ${s?.payer_last_name || ""}`.trim(),
      alta: dateOnly(s?.date_created),
      ultimoCobroFecha: dateOnly(s?.summarized?.last_charged_date),
      ultimoCobroMonto: s?.summarized?.last_charged_amount ?? null,
      cobrosAprobados: s?.summarized?.charged_quantity ?? null,
      proximoCobro: s.status === "authorized" ? dateOnly(s?.next_payment_date) : "",
      cuentaNumero: acc?.numero || "",
      cuentaNombre: acc?.nombre || "",
      cuentaEmail: acc?.email || "",
      cuentaPlan: acc?.plan || "",
      cuentaVence: acc?.vence || "",
      observacion: obs.join(" · "),
    };
  });
  const order: Record<string, number> = { authorized: 0, paused: 1, pending: 2, cancelled: 3 };
  filas.sort(
    (a, b) =>
      (order[a.estado] ?? 9) - (order[b.estado] ?? 9) ||
      (a.semaforo === "yellow" ? -1 : 0) - (b.semaforo === "yellow" ? -1 : 0) ||
      a.pagador.localeCompare(b.pagador)
  );

  const cuentasSinSuscripcion = users
    .filter((u) => {
      const meta = u.app_metadata || {};
      if (meta.plan_type !== "mensual") return false;
      const n = activeByUser.get(String(u.id)) || 0;
      return n === 0;
    })
    .map((u) => {
      const a = accountOf(u);
      return { numero: a.numero, nombre: a.nombre, email: a.email, vence: a.vence };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { generadoEl: new Date().toISOString(), filas, cuentasSinSuscripcion };
}

export interface ReconcileResult {
  desde: string;
  pagosRevisados: number;
  acreditados: { email: string; pago: string; monto: number | null; fecha: string; vence: string }[];
  yaAcreditados: number;
  sinCuenta: { pago: string; suscripcion: string; pagador: string; emailPago: string; monto: number | null; fecha: string }[];
  /** Cobros de HABA que no se reconocieron como de una suscripción (para diagnóstico) */
  noReconocidos: { pago: string; descripcion: string; referencia: string; monto: number | null; fecha: string; tipo: string }[];
  /** true si se cortó por el límite por corrida: hay que volver a correrla */
  truncado: boolean;
}

/**
 * Conciliación: recorre los cobros aprobados de los últimos días en Mercado Pago y acredita en
 * HABA los que todavía no se acreditaron (por ejemplo, si el aviso de Mercado Pago no llegó).
 * No depende del webhook. Cada pago se acredita una sola vez (registro mp_applied_payments).
 */
export async function reconcileSubscriptionCharges(
  options: { sinceDays?: number; maxApply?: number } = {}
): Promise<ReconcileResult> {
  const sinceDays = Math.min(Math.max(options.sinceDays ?? 20, 1), 60);
  // Límite de acreditaciones por corrida (cada una son varias llamadas): evita que el botón se corte
  const maxApply = Math.min(Math.max(options.maxApply ?? 25, 1), 200);
  const admin = getAdminClient();
  const planId = await resolvePlanId();
  const begin = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const result: ReconcileResult = {
    desde: begin.split("T")[0],
    pagosRevisados: 0,
    acreditados: [],
    yaAcreditados: 0,
    sinCuenta: [],
    noReconocidos: [],
    truncado: false,
  };

  // 1) Pagos aprobados del período (paginado)
  const payments: any[] = [];
  const PAGE = 100;
  for (let offset = 0, page = 0; page < 10; page++, offset += PAGE) {
    const q =
      `sort=date_approved&criteria=desc&range=date_approved&begin_date=${encodeURIComponent(begin)}` +
      `&end_date=${encodeURIComponent(end)}&status=approved&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(`${MP_API}/v1/payments/search?${q}`, { headers: mpHeaders() });
    if (!res.ok) {
      console.warn("[Conciliación MP] Búsqueda de pagos respondió", res.status);
      break;
    }
    const data = await res.json().catch(() => ({}));
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    payments.push(...results);
    if (results.length < PAGE) break;
  }

  // 2) Cuentas y pagos ya acreditados
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users: any[] = data?.users || [];
  const { data: profileRows } = await admin.from("profiles").select("id, email, mp_preapproval_id, last_payment_id");
  const profiles = new Map<string, any>((profileRows || []).map((r: any) => [String(r.id), r]));
  const userBySub = new Map<string, any>();
  const applied = new Set<string>();
  for (const u of users) {
    const prof = profiles.get(String(u.id));
    const subId = String(u.app_metadata?.mp_preapproval_id || prof?.mp_preapproval_id || "").trim();
    if (subId && !userBySub.has(subId)) userBySub.set(subId, u);
    for (const id of [u.app_metadata?.last_payment_id, prof?.last_payment_id, ...(u.app_metadata?.applied_payment_ids || [])]) {
      if (id) applied.add(String(id));
    }
  }
  const { data: ledger } = await admin.from("mp_applied_payments").select("payment_id");
  for (const row of ledger || []) if (row?.payment_id) applied.add(String(row.payment_id));

  // Suscripciones del plan por pagador de Mercado Pago: los cobros mensuales pueden no traer el id
  // de la suscripción, pero sí el id del pagador, y la suscripción activa de ese pagador es única.
  const subsByPayer = new Map<string, any[]>();
  if (planId) {
    const planSubs = await searchPreapprovals(`preapproval_plan_id=${encodeURIComponent(planId)}`);
    for (const s of planSubs) {
      const payerId = String(s?.payer_id || "").trim();
      if (!payerId || !s?.id) continue;
      const list = subsByPayer.get(payerId) || [];
      if (!list.some((x) => String(x.id) === String(s.id))) list.push(s);
      subsByPayer.set(payerId, list);
    }
  }
  const planTitle = (process.env.MP_SUBSCRIPTION_TITLE || "Haba Mensual").trim().toLowerCase();

  const preCache = new Map<string, any>();
  const getPre = async (id: string) => {
    if (!preCache.has(id)) preCache.set(id, await getPreapproval(id));
    return preCache.get(id);
  };

  for (const p of payments) {
    if (p?.status !== "approved") continue;
    const paymentId = String(p.id);
    let subId = String(p?.point_of_interaction?.transaction_data?.subscription_id || p?.metadata?.preapproval_id || "").trim();
    const payPlan = String(p?.point_of_interaction?.transaction_data?.plan_id || "").trim();
    const ref = String(p?.external_reference || "").trim();
    const description = String(p?.description || "").trim().toLowerCase();
    const payerId = String(p?.payer?.id || "").trim();
    const looksLikeHaba =
      /haba/i.test(ref) || (planTitle && description === planTitle) || /haba/i.test(description) ||
      String(p?.point_of_interaction?.type || "").toUpperCase() === "SUBSCRIPTIONS" ||
      String(p?.operation_type || "") === "recurring_payment";
    // Cobro sin id de suscripción (cobro mensual): por el pagador de Mercado Pago
    if (!subId && looksLikeHaba && payerId) {
      const list = (subsByPayer.get(payerId) || []).filter((s) => s.status === "authorized");
      const all = subsByPayer.get(payerId) || [];
      if (list.length === 1) subId = String(list[0].id);
      else if (list.length === 0 && all.length === 1) subId = String(all[0].id);
    }
    // Solo cobros de HABA: de una suscripción del plan o con el id de una cuenta como referencia
    const isPlanCharge = Boolean(subId) && (!planId || !payPlan || payPlan === planId);
    if (!isPlanCharge && !isHabaUserId(ref)) {
      if (looksLikeHaba) {
        result.noReconocidos.push({
          pago: paymentId,
          descripcion: String(p?.description || ""),
          referencia: ref,
          monto: p?.transaction_amount ?? null,
          fecha: String(p?.date_approved || p?.date_created || "").split("T")[0],
          tipo: `${p?.operation_type || ""}/${p?.point_of_interaction?.type || ""}`,
        });
      }
      continue;
    }
    result.pagosRevisados++;
    if (applied.has(paymentId)) {
      result.yaAcreditados++;
      continue;
    }
    if (result.acreditados.length >= maxApply) {
      result.truncado = true;
      continue;
    }

    // Cuenta: referencia del pago → suscripción vinculada → referencia de la suscripción → ventana del checkout → email
    let user: any = null;
    if (isHabaUserId(ref)) user = users.find((u) => String(u.id) === ref) || null;
    let pre: any = null;
    if (subId) {
      if (!user) user = userBySub.get(subId) || null;
      pre = await getPre(subId);
      const subRef = String(pre?.external_reference || "").trim();
      if (!user && isHabaUserId(subRef)) user = users.find((u) => String(u.id) === subRef) || null;
      if (!user && pre) {
        const byWindow = await findUserIdByCheckoutWindow(pre);
        if (byWindow) user = users.find((u) => String(u.id) === byWindow) || null;
      }
    }
    if (!user) {
      const email = String(p?.payer?.email || p?.additional_info?.payer?.email || pre?.payer_email || "").trim().toLowerCase();
      if (email) {
        const matches = users.filter(
          (u) =>
            String(u.email || "").toLowerCase() === email ||
            String(u.app_metadata?.mp_payer_email || "").toLowerCase() === email ||
            String(profiles.get(String(u.id))?.email || "").toLowerCase() === email
        );
        if (matches.length === 1) user = matches[0];
      }
    }
    if (!user) {
      result.sinCuenta.push({
        pago: paymentId,
        suscripcion: subId,
        pagador: `${p?.payer?.first_name || pre?.payer_first_name || ""} ${p?.payer?.last_name || pre?.payer_last_name || ""}`.trim(),
        emailPago: String(p?.payer?.email || pre?.payer_email || ""),
        monto: p?.transaction_amount ?? null,
        fecha: String(p?.date_approved || p?.date_created || "").split("T")[0],
      });
      continue;
    }

    const applyResult = await applyApprovedPaymentToUser({
      payment: p,
      userId: String(user.id),
      source: "sync",
      subscriptionNextPaymentDate: pre?.status === "authorized" ? pre?.next_payment_date || null : null,
    });
    if (applyResult.success) {
      applied.add(paymentId);
      result.acreditados.push({
        email: String(user.email || user.id),
        pago: paymentId,
        monto: p?.transaction_amount ?? null,
        fecha: String(p?.date_approved || p?.date_created || "").split("T")[0],
        vence: String(applyResult.newEndDate || ""),
      });
      if (subId && pre) {
        await saveSubscriptionState(String(user.id), {
          preapprovalId: subId,
          status: String(pre.status || "authorized"),
          payerEmail: pre.payer_email || p?.payer?.email || null,
          nextPaymentDate: pre.next_payment_date || null,
        });
        userBySub.set(subId, user);
      }
    } else if (applyResult.alreadyApplied) {
      result.yaAcreditados++;
      applied.add(paymentId);
    } else {
      console.warn(`[Conciliación MP] No se pudo acreditar el pago ${paymentId}: ${applyResult.error}`);
    }
  }
  return result;
}

export interface LinkAllResult {
  revisadas: number;
  vinculadas: { email: string; suscripcion: string; estado: string; como: "pago" | "email" }[];
  sinSuscripcion: string[];
  /** Suscripciones activas del plan que no se pudieron unir a ninguna cuenta */
  sinCuenta: { suscripcion: string; nombre: string; emailPago: string; monto: number | null; alta: string; razon: string }[];
}

/**
 * Pasada única: vincula cada cuenta con su suscripción en Mercado Pago (las del link del plan no
 * traen el id de la cuenta). Primero por el pago ya acreditado a la cuenta, después por el email
 * con el que se pagó cada suscripción activa del plan. Informa las que quedan sin cuenta.
 */
export async function linkAllSubscriptions(): Promise<LinkAllResult> {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users: any[] = data?.users || [];
  const { data: profileRows } = await admin.from("profiles").select("id, email, last_payment_id, mp_preapproval_id");
  const profiles = new Map<string, any>((profileRows || []).map((r: any) => [String(r.id), r]));
  const result: LinkAllResult = { revisadas: 0, vinculadas: [], sinSuscripcion: [], sinCuenta: [] };

  // Suscripciones activas del plan en Mercado Pago (sin duplicados de la paginación)
  const planId = await resolvePlanId();
  const subsRaw = planId
    ? await searchPreapprovals(`preapproval_plan_id=${encodeURIComponent(planId)}&status=authorized`)
    : [];
  // (se filtra acá por estado: no se confía en que la API aplique el parámetro)
  const subs = [
    ...new Map(subsRaw.filter((s) => s?.id && s?.status === "authorized").map((s) => [String(s.id), s])).values(),
  ];
  const authorizedIds = new Set(subs.map((s) => String(s.id)));

  // Una cuenta cuenta como vinculada solo si su suscripción guardada es una activa del plan
  // (un id viejo, cancelado o equivocado no vale: se vuelve a vincular)
  const linkedSubs = new Set<string>();
  const linkedUsers = new Set<string>();
  for (const u of users) {
    const id = String(u.app_metadata?.mp_preapproval_id || profiles.get(String(u.id))?.mp_preapproval_id || "").trim();
    if (id && authorizedIds.has(id)) {
      linkedSubs.add(id);
      linkedUsers.add(String(u.id));
    }
  }

  // A) Cuentas con pagos acreditados: el pago dice a qué suscripción pertenece
  for (const u of users) {
    if (linkedUsers.has(String(u.id))) continue;
    const meta = u.app_metadata || {};
    const prof = profiles.get(String(u.id));
    const hasPayments =
      Boolean(meta.last_payment_id) ||
      Boolean(prof?.last_payment_id) ||
      (Array.isArray(meta.applied_payment_ids) && meta.applied_payment_ids.length > 0);
    if (!hasPayments) continue;
    result.revisadas++;
    const pre = await linkSubscriptionFromAppliedPayments(u.id);
    if (pre) {
      result.vinculadas.push({ email: u.email || u.id, suscripcion: String(pre.id), estado: String(pre.status || ""), como: "pago" });
      linkedSubs.add(String(pre.id));
      linkedUsers.add(String(u.id));
    } else {
      result.sinSuscripcion.push(u.email || u.id);
    }
  }

  // B) Suscripciones activas del plan todavía sin cuenta: por el email con el que se pagó.
  //    La suscripción no trae el email: se toma de sus pagos (los pagos recientes dicen a qué
  //    suscripción pertenecen y con qué email se pagaron).
  if (planId) {
    const payerBySub = await payerEmailBySubscriptionFromRecentPayments();
    for (const s of subs) {
      const subId = String(s?.id || "");
      if (!subId || s?.status !== "authorized" || linkedSubs.has(subId)) continue;
      const ref = String(s?.external_reference || "").trim();
      let userId: string | null = null;
      if (isHabaUserId(ref)) {
        userId = users.some((u) => String(u.id) === ref) ? ref : null;
      }
      let pre: any = s;
      let payerEmail = "";
      let razon = "";
      if (!userId) {
        pre = (await getPreapproval(subId)) || s;
        payerEmail = String(pre?.payer_email || payerBySub.get(subId)?.email || "").trim().toLowerCase();
        const email = payerEmail;
        if (email) {
          const matches = users.filter(
            (u) =>
              String(u.email || "").toLowerCase() === email ||
              String(u.app_metadata?.mp_payer_email || "").toLowerCase() === email ||
              String(profiles.get(String(u.id))?.email || "").toLowerCase() === email
          );
          if (matches.length === 1) userId = String(matches[0].id);
          else razon = matches.length === 0 ? "ninguna cuenta de HABA tiene ese correo" : "varias cuentas tienen ese correo";
        } else {
          razon = "sin correo de pago (pago anterior a los últimos 500)";
        }
      }
      if (userId && linkedUsers.has(userId)) {
        const u = users.find((x) => String(x.id) === userId);
        razon = `la cuenta ${u?.email || userId} ya está vinculada a otra suscripción activa`;
      }
      if (userId && !linkedUsers.has(userId)) {
        result.revisadas++;
        await saveSubscriptionState(userId, {
          preapprovalId: subId,
          status: String(pre?.status || "authorized"),
          payerEmail: payerEmail || pre?.payer_email || null,
          nextPaymentDate: pre?.next_payment_date || null,
        });
        const u = users.find((x) => String(x.id) === userId);
        result.vinculadas.push({ email: u?.email || userId, suscripcion: subId, estado: String(pre?.status || ""), como: "email" });
        linkedSubs.add(subId);
        linkedUsers.add(userId);
      } else {
        result.sinCuenta.push({
          suscripcion: subId,
          nombre: `${s?.payer_first_name || ""} ${s?.payer_last_name || ""}`.trim() || String(s?.payer_id || ""),
          emailPago: payerEmail || String(pre?.payer_email || ""),
          monto: s?.summarized?.last_charged_amount ?? s?.auto_recurring?.transaction_amount ?? null,
          alta: String(s?.date_created || "").split("T")[0],
          razon,
        });
      }
    }
  }
  return result;
}

/** Guarda el estado de la suscripción en app_metadata (no editable por la usuaria) y en profiles. */
export async function saveSubscriptionState(
  userId: string,
  state: {
    preapprovalId?: string | null;
    status: string;
    payerEmail?: string | null;
    nextPaymentDate?: string | null;
    checkoutStartedAt?: string | null;
  }
) {
  const admin = getAdminClient();
  const { data: authRes } = await admin.auth.admin.getUserById(userId);
  const authUser = authRes?.user;
  if (authUser) {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...authUser.app_metadata,
        mp_status: state.status,
        ...(state.preapprovalId ? { mp_preapproval_id: state.preapprovalId } : {}),
        ...(state.payerEmail ? { mp_payer_email: state.payerEmail } : {}),
        ...(state.nextPaymentDate ? { mp_next_payment_date: state.nextPaymentDate } : {}),
        ...(state.checkoutStartedAt ? { mp_checkout_started_at: state.checkoutStartedAt } : {}),
      },
      user_metadata: {
        ...(authUser.user_metadata || {}),
        mp_status: state.status,
      },
    });
  }
  const profilePayload: Record<string, any> = { mp_status: state.status, updated_at: new Date().toISOString() };
  if (state.preapprovalId) profilePayload.mp_preapproval_id = state.preapprovalId;
  await admin.from("profiles").update(profilePayload).eq("id", userId);
}

export interface CreateSubscriptionResult {
  success: boolean;
  status?: string;
  preapprovalId?: string;
  nextPaymentDate?: string | null;
  alreadySubscribed?: boolean;
  /** Link de Mercado Pago para terminar de activar la suscripción (modo sin tarjeta). */
  initPoint?: string;
  error?: string;
}

/** Traduce los errores habituales de Mercado Pago a un mensaje claro. */
function friendlyMpError(data: any, status: number): string {
  const raw = String(data?.message || data?.error || "").toLowerCase();
  // Tarjetas con código de seguridad dinámico (por ejemplo la de Mercado Pago, física o virtual):
  // Mercado Pago no las acepta para cobros automáticos con tarjeta.
  if (raw.includes("cvv"))
    return "Esta tarjeta no se puede usar para el cobro automático (por ejemplo, la tarjeta de Mercado Pago). Probá con una tarjeta de crédito o débito de un banco.";
  if (raw.includes("card token was used")) return "Los datos de la tarjeta vencieron. Volvé a cargarlos y probá de nuevo.";
  if (raw.includes("card_token")) return "La tarjeta no se pudo validar. Revisá los datos y probá de nuevo.";
  if (raw.includes("payer_email") || raw.includes("email")) return "Revisá el email ingresado en el formulario.";
  if (raw.includes("rejected") || raw.includes("cc_rejected")) return "La tarjeta fue rechazada. Probá con otra tarjeta.";
  if (status >= 500) return "Mercado Pago no respondió. Probá de nuevo en unos minutos.";
  return data?.message ? `Mercado Pago: ${data.message}` : "No se pudo crear la suscripción.";
}

export async function createUserSubscription(options: {
  user: any;
  cardTokenId: string;
  payerEmail: string;
  appUrl: string;
}): Promise<CreateSubscriptionResult> {
  const { user, cardTokenId, payerEmail, appUrl } = options;

  // No duplicar: si ya tiene una suscripción activa con su id, no se crea otra.
  // Una pendiente (abrió el link de Mercado Pago y no terminó) no bloquea un nuevo intento.
  const existing = await getUserSubscription(user);
  if (existing && existing.status === "authorized") {
    return {
      success: false,
      alreadySubscribed: true,
      status: existing.status,
      preapprovalId: existing.id,
      nextPaymentDate: existing.next_payment_date || null,
      error: "Ya tenés una suscripción activa. Se renueva sola cada mes.",
    };
  }

  const planId = await resolvePlanId();
  if (!planId) return { success: false, error: "La suscripción no está disponible por el momento." };

  const res = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: mpHeaders({ "X-Idempotency-Key": `haba-sub-${user.id}-${cardTokenId.slice(0, 24)}` }),
    body: JSON.stringify({
      preapproval_plan_id: planId,
      reason: process.env.MP_SUBSCRIPTION_TITLE || "Haba Mensual",
      external_reference: user.id,
      payer_email: payerEmail,
      card_token_id: cardTokenId,
      back_url: `${appUrl}/configuracion?status=approved`,
      status: "authorized",
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.id) {
    console.error("[Suscripción MP] Error al crear la suscripción:", res.status, data);
    // Diagnóstico: qué registró Mercado Pago del token (nunca incluye el número de la tarjeta)
    try {
      const tokRes = await fetch(`${MP_API}/v1/card_tokens/${encodeURIComponent(cardTokenId)}`, { headers: mpHeaders() });
      const tok = await tokRes.json().catch(() => ({}));
      const { card_number_length, security_code_length, status, luhn_validation, live_mode, cardholder, ...rest } = tok || {};
      console.error("[Suscripción MP] Datos del token:", tokRes.status, {
        card_number_length,
        security_code_length,
        status,
        luhn_validation,
        live_mode,
        identification_type: cardholder?.identification?.type,
        other_keys: Object.keys(rest || {}),
      });
    } catch (diagErr) {
      console.warn("[Suscripción MP] No se pudo consultar el token:", diagErr);
    }
    return { success: false, error: friendlyMpError(data, res.status) };
  }

  await saveSubscriptionState(user.id, {
    preapprovalId: String(data.id),
    status: data.status || "authorized",
    payerEmail,
    nextPaymentDate: data.next_payment_date || null,
  });

  console.log(`[Suscripción MP] Suscripción ${data.id} (${data.status}) creada para ${user.id}`);
  return {
    success: true,
    status: data.status,
    preapprovalId: String(data.id),
    nextPaymentDate: data.next_payment_date || null,
  };
}

/**
 * Pagar con la cuenta de Mercado Pago (saldo, tarjeta de Mercado Pago o cualquier tarjeta):
 * se manda a la usuaria al checkout del plan único con external_reference = id de su cuenta.
 * Mercado Pago crea la suscripción ASOCIADA AL PLAN (cobro el día 8 con proporcional, figura en
 * "Clientes") y respeta ese id, como se comprobó en producción. No se crea nada desde HABA:
 * al pagar, el webhook o la vuelta a la app la vinculan por el id.
 */
export async function getPlanCheckoutLink(options: {
  user: any;
  appUrl: string;
}): Promise<CreateSubscriptionResult> {
  const { user, appUrl } = options;

  const existing = await getUserSubscription(user);
  if (existing && existing.status === "authorized") {
    return {
      success: false,
      alreadySubscribed: true,
      status: existing.status,
      preapprovalId: existing.id,
      nextPaymentDate: existing.next_payment_date || null,
      error: "Ya tenés una suscripción activa. Se renueva sola cada mes.",
    };
  }

  const planId = await resolvePlanId();
  if (!planId) return { success: false, error: "La suscripción no está disponible por el momento." };

  const params = new URLSearchParams({
    preapproval_plan_id: planId,
    external_reference: user.id,
    back_url: `${appUrl}/configuracion?status=approved`,
  });
  const initPoint = `https://www.mercadopago.com.ar/subscriptions/checkout?${params.toString()}`;

  // Dejar registrado que esta cuenta inició la suscripción (sirve para vincular al volver)
  await saveSubscriptionState(user.id, { status: "pending_checkout", checkoutStartedAt: new Date().toISOString() });

  return { success: true, status: "pending", initPoint };
}

/**
 * Busca en Mercado Pago la suscripción de esta cuenta por external_reference (la que crea el
 * checkout del plan) y la guarda. Se usa al volver del checkout y en la sincronización manual.
 */
const SEARCH_PAGE_SIZE = 20;

/** Búsqueda de suscripciones paginada de a 20 (tamaño comprobado con la API) hasta agotar los resultados. */
async function searchPreapprovals(query: string): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0, page = 0; page < 15; page++, offset += SEARCH_PAGE_SIZE) {
    const res = await fetch(`${MP_API}/preapproval/search?${query}&limit=${SEARCH_PAGE_SIZE}&offset=${offset}`, {
      headers: mpHeaders(),
    });
    if (!res.ok) {
      console.warn("[Suscripción MP] Búsqueda de suscripciones respondió", res.status, query.split("&")[0]);
      break;
    }
    const data = await res.json().catch(() => ({}));
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    out.push(...results);
    if (results.length < SEARCH_PAGE_SIZE) break;
  }
  return out;
}

/** Cuenta de HABA que ya tiene guardada esta suscripción (vinculada por el webhook, al actualizar o por Gio). */
export async function findUserIdBySavedPreapproval(preapprovalId: string): Promise<string | null> {
  const id = String(preapprovalId || "").trim();
  if (!id) return null;
  const { data } = await getAdminClient().from("profiles").select("id").eq("mp_preapproval_id", id).maybeSingle();
  return data?.id ? String(data.id) : null;
}

/**
 * Cuenta que inició el checkout desde HABA poco antes de que Mercado Pago creara esta suscripción
 * (sin id de cuenta). Solo si hay una única candidata; si hay varias, no se asigna sola.
 */
export async function findUserIdByCheckoutWindow(subscription: any): Promise<string | null> {
  const subId = String(subscription?.id || "").trim();
  const created = Date.parse(String(subscription?.date_created || ""));
  if (!subId || !isFinite(created)) return null;
  const ref = String(subscription?.external_reference || "").trim();
  if (isHabaUserId(ref)) return null;
  const owner = await findUserIdBySavedPreapproval(subId);
  if (owner) return owner;
  const { data } = await getAdminClient().auth.admin.listUsers({ perPage: 1000 });
  const candidates = (data?.users || []).filter((u: any) => {
    const meta = u.app_metadata || {};
    if (meta.mp_status !== "pending_checkout") return false;
    const started = Date.parse(String(meta.mp_checkout_started_at || ""));
    if (!isFinite(started)) return false;
    // Empezó el checkout hasta 3 horas antes (y no después) de que se creara la suscripción
    return started <= created + 5 * 60 * 1000 && created - started <= 3 * 60 * 60 * 1000;
  });
  if (candidates.length === 1) return String(candidates[0].id);
  if (candidates.length > 1) {
    console.warn(`[Suscripción MP] ${candidates.length} cuentas iniciaron el checkout cerca de ${subId}; no se asigna sola.`);
  }
  return null;
}

export async function findAndSaveSubscriptionByReference(
  userId: string,
  userEmail?: string | null
): Promise<any | null> {
  try {
    const email = String(userEmail || "").trim().toLowerCase();
    const planId = await resolvePlanId();
    // Mercado Pago no documenta el filtro por external_reference en /preapproval/search y rechaza
    // cualquier parámetro de orden ("Invalid sorting value format"): se consultan las suscripciones
    // del plan (y las del email de la cuenta) sin orden y se filtra y ordena acá.
    const queries = [`external_reference=${encodeURIComponent(userId)}`];
    if (planId) queries.push(`preapproval_plan_id=${encodeURIComponent(planId)}`);
    if (email) queries.push(`payer_email=${encodeURIComponent(email)}`);

    const seen = new Map<string, any>();
    for (const q of queries) {
      for (const p of await searchPreapprovals(q)) {
        if (p?.id && !seen.has(String(p.id))) seen.set(String(p.id), p);
      }
    }
    const byDateDesc = (a: any, b: any) => String(b?.date_created || "").localeCompare(String(a?.date_created || ""));
    const pick = (list: any[]) =>
      list.find((p) => p.status === "authorized") || list.find((p) => p.status === "pending") || list[0];

    // 1) Con el id de la cuenta como referencia (checkout del plan y formulario de tarjeta)
    const byRef = [...seen.values()]
      .filter((p) => String(p?.external_reference || "").trim() === userId)
      .sort(byDateDesc);
    let match = pick(byRef);

    // 2) Por el pago ya acreditado a la cuenta (dice a qué suscripción pertenece)
    if (!match) {
      const linked = await linkSubscriptionFromAppliedPayments(userId);
      if (linked) return linked;
    }

    const withoutAccountId = (p: any) => {
      const ref = String(p?.external_reference || "").trim();
      return !ref || (!isHabaUserId(ref) && /haba/i.test(ref));
    };
    const notOwnedByAnother = async (p: any) => {
      const owner = await findUserIdBySavedPreapproval(String(p.id));
      return !owner || owner === userId;
    };

    // 3) Al volver del checkout iniciado desde HABA: Mercado Pago a veces no guarda el id de la
    //    cuenta (sobre todo al pagar desde su app). La suscripción del plan creada después de
    //    empezar el checkout y sin dueño es la de esta cuenta, siempre que sea la única candidata.
    if (!match) {
      const { data: authRes } = await getAdminClient().auth.admin.getUserById(userId);
      const startedAt = String(authRes?.user?.app_metadata?.mp_checkout_started_at || "");
      if (startedAt) {
        const since = new Date(new Date(startedAt).getTime() - 10 * 60 * 1000).toISOString();
        const candidates = [...seen.values()].filter(
          (p) =>
            withoutAccountId(p) &&
            p?.status === "authorized" &&
            (!planId || String(p?.preapproval_plan_id || "") === planId) &&
            String(p?.date_created || "") >= since
        );
        const free: any[] = [];
        for (const c of candidates) if (await notOwnedByAnother(c)) free.push(c);
        if (free.length === 1) match = free[0];
        else if (free.length > 1) console.warn(`[Suscripción MP] ${free.length} suscripciones nuevas sin dueño; no se asigna sola.`);
      }
    }

    // 4) Sin id de cuenta (vacío o la referencia vieja "Haba suscripción mensual"), activa, del plan,
    //    pagada con el email de la cuenta y no vinculada a otra cuenta
    if (!match && email) {
      const byEmail = [...seen.values()]
        .filter(
          (p) =>
            withoutAccountId(p) &&
            p?.status === "authorized" &&
            String(p?.payer_email || "").trim().toLowerCase() === email &&
            (!planId || String(p?.preapproval_plan_id || "") === planId)
        )
        .sort(byDateDesc);
      for (const candidate of byEmail) {
        const { data: other } = await getAdminClient()
          .from("profiles")
          .select("id")
          .eq("mp_preapproval_id", String(candidate.id))
          .neq("id", userId)
          .maybeSingle();
        if (!other?.id) {
          match = candidate;
          break;
        }
      }
    }
    if (!match) return null;

    await saveSubscriptionState(userId, {
      preapprovalId: String(match.id),
      status: match.status,
      payerEmail: match.payer_email || null,
      nextPaymentDate: match.next_payment_date || null,
    });
    return match;
  } catch (err) {
    console.warn("[Suscripción MP] No se pudo buscar la suscripción de la cuenta:", err);
    return null;
  }
}

/**
 * Sincroniza la suscripción de la usuaria con Mercado Pago (por ejemplo al volver del checkout,
 * antes de que llegue el aviso del webhook): registra el estado actual y, si ya está autorizada,
 * alinea el vencimiento con el próximo cobro. Los cobros en sí se acreditan por el webhook, con su
 * registro anti-duplicados. Si la cuenta no tiene suscripción guardada o la guardada no está
 * autorizada, se busca por el id de la cuenta (la crea el checkout del plan).
 */
export async function syncUserSubscription(userId: string): Promise<{ status: string | null; activated: boolean }> {
  const admin = getAdminClient();
  const { data: authRes } = await admin.auth.admin.getUserById(userId);
  const user = authRes?.user;
  if (!user) return { status: null, activated: false };
  let pre = await getUserSubscription(user);
  if (!pre || pre.status !== "authorized") {
    const found = await findAndSaveSubscriptionByReference(userId, user.email);
    if (found) pre = found;
  }
  if (!pre) return { status: null, activated: false };

  const previous = String(user.app_metadata?.mp_status || "");
  await saveSubscriptionState(userId, {
    preapprovalId: String(pre.id),
    status: pre.status,
    nextPaymentDate: pre.next_payment_date || null,
  });
  if (pre.status === "authorized") {
    await alignPlanEndDateToNextPayment(userId, pre.next_payment_date || null);
  }
  return { status: pre.status, activated: pre.status === "authorized" && previous !== "authorized" };
}

/** Cancela la suscripción de la usuaria. No corta el acceso: sigue hasta el último día pagado. */
export async function cancelUserSubscription(user: any): Promise<{ success: boolean; error?: string }> {
  const pre = await getUserSubscription(user);
  if (!pre) return { success: false, error: "No encontramos una suscripción activa en tu cuenta." };
  if (pre.status === "cancelled") {
    await saveSubscriptionState(user.id, { status: "cancelled" });
    return { success: true };
  }

  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(pre.id)}`, {
    method: "PUT",
    headers: mpHeaders(),
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("[Suscripción MP] Error al cancelar:", res.status, data);
    return { success: false, error: "No se pudo cancelar en Mercado Pago. Probá de nuevo en unos minutos." };
  }

  await saveSubscriptionState(user.id, { status: "cancelled" });
  console.log(`[Suscripción MP] Suscripción ${pre.id} cancelada por la usuaria ${user.id}`);
  return { success: true };
}

/**
 * Asegura que la cuenta quede vigente al menos hasta `date` (fecha del próximo cobro de su
 * suscripción). Solo extiende, nunca acorta. Se usa después de un cobro aprobado de la suscripción.
 */
export async function ensurePlanEndDateAtLeast(userId: string, date: string | null | undefined) {
  const target = date ? String(date).split("T")[0] : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return;
  const admin = getAdminClient();
  const { data: authRes } = await admin.auth.admin.getUserById(userId);
  const authUser = authRes?.user;
  if (!authUser) return;
  const current = String(authUser.app_metadata?.plan_end_date || "");
  if (current && current >= target) return;
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...authUser.app_metadata, plan_end_date: target, plan_type: "mensual" },
    user_metadata: { ...(authUser.user_metadata || {}), plan_end_date: target, plan_type: "mensual" },
  });
  await admin
    .from("profiles")
    .update({ plan_end_date: target, plan_type: "mensual", updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/**
 * Con una suscripción activa, el vencimiento de la cuenta es el próximo cobro + días de gracia:
 * ni antes (no pierde días pagados) ni después (un vencimiento viejo guardado no regala meses).
 */
export async function alignPlanEndDateToNextPayment(userId: string, nextPaymentDate: string | null | undefined) {
  const next = nextPaymentDate ? String(nextPaymentDate).split("T")[0] : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
  const target = addDaysToDate(next, SUBSCRIPTION_GRACE_DAYS);
  const admin = getAdminClient();
  const { data: authRes } = await admin.auth.admin.getUserById(userId);
  const authUser = authRes?.user;
  if (!authUser) return;
  if (String(authUser.app_metadata?.plan_end_date || "") === target) return;
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...authUser.app_metadata, plan_end_date: target, plan_type: "mensual" },
    user_metadata: { ...(authUser.user_metadata || {}), plan_end_date: target, plan_type: "mensual" },
  });
  await admin
    .from("profiles")
    .update({ plan_end_date: target, plan_type: "mensual", updated_at: new Date().toISOString() })
    .eq("id", userId);
}
