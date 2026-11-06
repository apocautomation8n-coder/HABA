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
import { addDaysToDate, getExpectedPlanAmount, SUBSCRIPTION_GRACE_DAYS } from "@/lib/mercadopago";

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
  if (!pre || String(pre.external_reference || "").trim() !== user.id) return null;
  return pre;
}

/** Guarda el estado de la suscripción en app_metadata (no editable por la usuaria) y en profiles. */
export async function saveSubscriptionState(
  userId: string,
  state: { preapprovalId?: string | null; status: string; payerEmail?: string | null; nextPaymentDate?: string | null }
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
  await saveSubscriptionState(user.id, { status: "pending_checkout" });

  return { success: true, status: "pending", initPoint };
}

/**
 * Busca en Mercado Pago la suscripción de esta cuenta por external_reference (la que crea el
 * checkout del plan) y la guarda. Se usa al volver del checkout y en la sincronización manual.
 */
export async function findAndSaveSubscriptionByReference(userId: string): Promise<any | null> {
  try {
    // Orden: "sort=campo&criteria=desc" (el formato "campo:desc" lo rechaza Mercado Pago)
    const res = await fetch(
      `${MP_API}/preapproval/search?external_reference=${encodeURIComponent(userId)}&sort=date_created&criteria=desc&limit=10`,
      { headers: mpHeaders() }
    );
    if (!res.ok) {
      console.warn("[Suscripción MP] Búsqueda por referencia respondió", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const results: any[] = (Array.isArray(data.results) ? data.results : [])
      .filter((p: any) => String(p?.external_reference || "").trim() === userId)
      .sort((a: any, b: any) => String(b?.date_created || "").localeCompare(String(a?.date_created || "")));
    const match =
      results.find((p) => p.status === "authorized") ||
      results.find((p) => p.status === "pending") ||
      results[0];
    if (!match || String(match.external_reference || "").trim() !== userId) return null;
    await saveSubscriptionState(userId, {
      preapprovalId: String(match.id),
      status: match.status,
      payerEmail: match.payer_email || null,
      nextPaymentDate: match.next_payment_date || null,
    });
    return match;
  } catch (err) {
    console.warn("[Suscripción MP] No se pudo buscar la suscripción por referencia:", err);
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
    const found = await findAndSaveSubscriptionByReference(userId);
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
