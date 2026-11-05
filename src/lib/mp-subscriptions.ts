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

  // No duplicar: si ya tiene una suscripción activa con su id, no se crea otra
  const existing = await getUserSubscription(user);
  if (existing && (existing.status === "authorized" || existing.status === "pending")) {
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
