import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getTrustedPlanMeta } from "@/lib/plan-helpers";
import { MercadoPagoConfig, Preference } from "mercadopago";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Calcula la nueva fecha de fin de vigencia (30 días adicionales):
 * - Si la cuenta tiene vigencia actual en el futuro (o vence hoy), se le suman 30 días a esa fecha.
 * - Si la cuenta ya está vencida o no tiene fecha configurada, se le suman 30 días a partir de hoy (Date.now()).
 */
export function calculateNewPlanEndDate(
  currentEndDateStr: string | null | undefined,
  days: number = 30
): string {
  const todayStr = new Date().toISOString().split("T")[0];
  let baseDate: Date;

  if (currentEndDateStr && currentEndDateStr >= todayStr) {
    // Vigente en el futuro o hoy: sumar 30 días a currentEndDate
    const [y, m, d] = currentEndDateStr.split("T")[0].split("-").map((n) => parseInt(n, 10));
    baseDate = new Date(Date.UTC(y, m - 1, d));
  } else {
    // Vencida o sin fecha: sumar 30 días desde la fecha actual
    const now = new Date();
    baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + Math.max(1, Math.round(days)));
  return baseDate.toISOString().split("T")[0];
}

/**
 * Días de plan que cubre un pago. El precio completo (o más) acredita 30 días. Un pago menor,
 * por ejemplo el primer cobro proporcional de la suscripción anterior hasta el día 8, acredita
 * solo los días proporcionales a lo que se pagó (mínimo 1). Si la moneda no coincide con la del
 * plan no se puede comparar el monto y se acreditan los 30 días.
 */
export function getPlanDaysForPayment(payment: any): number {
  const amount = Number(payment?.transaction_amount);
  const expected = getExpectedPlanAmount();
  const expectedCurrency = (process.env.MP_SUBSCRIPTION_CURRENCY || "ARS").toUpperCase();
  const currency = payment?.currency_id ? String(payment.currency_id).toUpperCase() : expectedCurrency;
  if (!isFinite(amount) || amount <= 0 || currency !== expectedCurrency) return 30;
  if (amount >= expected * 0.99) return 30;
  return Math.max(1, Math.min(30, Math.round((30 * amount) / expected)));
}

export interface CreatePreferenceResult {
  success: boolean;
  url?: string;
  init_point?: string;
  preference_id?: string;
  error?: string;
}

/**
 * 1. Migración a Checkout Pro (Cobro Único de ciclo mensual):
 * - Crea una preferencia en /checkout/preferences con cobro único por 30 días de acceso.
 * - OMITIR estrictamente `payer_email` para permitir que cualquier usuario pague con cualquier cuenta de MP o tarjeta,
 *   y que una misma billetera de MP pueda abonar varias cuentas distintas de HABA.
 * - Envía siempre `external_reference: user.id` (UUID del usuario en Supabase).
 */
export async function createCheckoutPreference(options: {
  userId: string;
  appUrl: string;
  returnPath?: string;
}): Promise<CreatePreferenceResult> {
  const { userId, appUrl, returnPath = "/configuracion?status=approved" } = options;
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return { success: false, error: "MP_ACCESS_TOKEN no configurado en las variables de entorno del servidor." };
  }

  if (!userId) {
    return { success: false, error: "userId es obligatorio para crear la preferencia." };
  }

  const cleanAppUrl = appUrl.replace(/\/$/, "");
  const normalizedReturnPath = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  const redirectSuccessUrl = `${cleanAppUrl}${normalizedReturnPath}`;

  const amount = Number(process.env.MP_SUBSCRIPTION_AMOUNT || 7000);
  const currency = process.env.MP_SUBSCRIPTION_CURRENCY || "ARS";
  const title = process.env.MP_SUBSCRIPTION_TITLE || "HABA - Plan Mensual (30 días)";

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items: [
          {
            id: "haba-plan-mensual",
            title: title,
            description: "Acceso completo a HABA por 30 días",
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        external_reference: userId,
        back_urls: {
          success: redirectSuccessUrl,
          pending: redirectSuccessUrl,
          failure: redirectSuccessUrl,
        },
        auto_return: "approved",
        statement_descriptor: "HABA",
        notification_url: `${cleanAppUrl}/api/webhooks/mercadopago`,
      },
    });

    const initPoint = response.init_point || response.sandbox_init_point;

    if (!initPoint) {
      return { success: false, error: "Mercado Pago SDK no retornó init_point." };
    }

    return {
      success: true,
      url: initPoint,
      init_point: initPoint,
      preference_id: response.id,
    };
  } catch (err: any) {
    console.error("[Mercado Pago Preferences SDK] Excepción creando preferencia:", err);
    return { success: false, error: err.message || "Error al conectar con Mercado Pago" };
  }
}

export interface ApplyPaymentResult {
  success: boolean;
  alreadyApplied?: boolean;
  newEndDate?: string;
  paymentId?: string;
  error?: string;
}

/** Días de gracia después del próximo cobro de una suscripción, por si Mercado Pago demora el cobro. */
export const SUBSCRIPTION_GRACE_DAYS = 3;

/** Suma días a una fecha YYYY-MM-DD sin mirar la fecha de hoy (a diferencia de calculateNewPlanEndDate). */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("T")[0].split("-").map((n) => parseInt(n, 10));
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + Math.round(days));
  return base.toISOString().split("T")[0];
}

/** Cuántos IDs de pagos acreditados se guardan en app_metadata como respaldo del registro. */
const APPLIED_PAYMENT_IDS_LIMIT = 100;

/** Monto esperado del plan (el mismo que usa create-preference). */
export function getExpectedPlanAmount(): number {
  const amount = Number(process.env.MP_SUBSCRIPTION_AMOUNT || 7000);
  return isNaN(amount) || amount <= 0 ? 7000 : amount;
}

/** true si el pago cubre el precio completo del plan (tolerancia de 1% por redondeos). */
export function paymentCoversPlan(payment: any): boolean {
  const amount = Number(payment?.transaction_amount);
  if (isNaN(amount)) return false;
  const expectedCurrency = (process.env.MP_SUBSCRIPTION_CURRENCY || "ARS").toUpperCase();
  if (payment?.currency_id && String(payment.currency_id).toUpperCase() !== expectedCurrency) return false;
  return amount >= getExpectedPlanAmount() * 0.99;
}

function isMissingLedgerTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    (err.message || "").toLowerCase().includes("mp_applied_payments")
  );
}

/**
 * Aplica de forma atómica y segura un pago aprobado a la cuenta del usuario en Supabase:
 * - Valida status === 'approved'.
 * - Anti-abuso: cada pago se acredita UNA sola vez y a UNA sola cuenta. Se registra primero en
 *   public.mp_applied_payments (payment_id es clave primaria, así un segundo intento falla en la base)
 *   y además en app_metadata.applied_payment_ids como respaldo. Esto impide repetir el mismo pago,
 *   alternar entre pagos viejos o reclamar el pago de otra persona.
 * - Calcula la nueva fecha (currentEndDate + 30 días si vigente, o hoy + 30 días si vencida).
 * - Actualiza `profiles` y Supabase Auth (`app_metadata`, fuente de verdad, y `user_metadata` para la UI).
 * Nunca se lee el historial de pagos desde user_metadata: la usuaria lo puede editar.
 */
export async function applyApprovedPaymentToUser(options: {
  payment: any;
  userId: string;
  source?: "webhook" | "sync" | "admin";
  /**
   * Fecha mínima de vencimiento. En la suscripción automática es la fecha del próximo cobro:
   * la cuenta sigue vigente hasta ese día, cuando Mercado Pago vuelve a cobrar y se renueva.
   */
  minEndDate?: string | null;
  /**
   * Fecha del próximo cobro de una suscripción activa. Cuando se conoce, el vencimiento queda
   * exactamente en esa fecha (más los días de gracia): ni antes ni después. Evita que un
   * vencimiento viejo guardado en la cuenta se sume a un pago nuevo y regale meses.
   */
  subscriptionNextPaymentDate?: string | null;
}): Promise<ApplyPaymentResult> {
  const { payment, userId, source = "webhook", subscriptionNextPaymentDate } = options;
  const minEndDate = options.minEndDate ?? subscriptionNextPaymentDate ?? null;

  if (!payment || payment.status !== "approved") {
    return {
      success: false,
      error: `El pago no está aprobado (estado actual: '${payment?.status || "desconocido"}').`,
    };
  }

  const paymentIdStr = String(payment.id);
  const supabaseAdmin = getAdminClient();

  // 1. Obtener perfil actual del usuario
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, plan_type, plan_end_date, account_status, last_payment_id")
    .eq("id", userId)
    .maybeSingle();

  // 2. Obtener Auth user para plan_end_date de app_metadata como respaldo
  const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const authUser = authRes?.user;

  if (!profile && !authUser) {
    return { success: false, error: `No se encontró el usuario con id '${userId}' en Supabase.` };
  }

  // 3. Anti-abuso por cuenta (solo datos que la usuaria no puede editar)
  const previousIds: string[] = Array.isArray(authUser?.app_metadata?.applied_payment_ids)
    ? authUser!.app_metadata.applied_payment_ids.map((id: unknown) => String(id))
    : [];
  const knownIds = new Set<string>(previousIds);
  if (profile?.last_payment_id) knownIds.add(String(profile.last_payment_id));
  if (authUser?.app_metadata?.last_payment_id) knownIds.add(String(authUser.app_metadata.last_payment_id));

  if (knownIds.has(paymentIdStr)) {
    return {
      success: false,
      alreadyApplied: true,
      paymentId: paymentIdStr,
      error: `El pago #${paymentIdStr} ya fue aplicado anteriormente a esta cuenta. No se pueden duplicar días de vigencia.`,
    };
  }

  // 4. Anti-abuso global: reservar el pago en el registro único antes de acreditar
  let ledgerReserved = false;
  const { error: ledgerErr } = await supabaseAdmin.from("mp_applied_payments").insert({
    payment_id: paymentIdStr,
    user_id: userId,
    amount: Number(payment.transaction_amount) || null,
    currency: payment.currency_id || null,
    source,
  });

  if (ledgerErr) {
    if (ledgerErr.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("mp_applied_payments")
        .select("user_id")
        .eq("payment_id", paymentIdStr)
        .maybeSingle();
      const sameUser = existing?.user_id === userId;
      return {
        success: false,
        alreadyApplied: true,
        paymentId: paymentIdStr,
        error: sameUser
          ? `El pago #${paymentIdStr} ya fue aplicado anteriormente a esta cuenta. No se pueden duplicar días de vigencia.`
          : `El pago #${paymentIdStr} ya fue acreditado a otra cuenta de HABA.`,
      };
    }
    if (isMissingLedgerTable(ledgerErr)) {
      // Mientras no se cree la tabla, queda el control por cuenta (app_metadata)
      console.warn("[Mercado Pago] Falta la tabla mp_applied_payments; se usa solo el control por cuenta.");
    } else {
      console.error("[Mercado Pago] No se pudo registrar el pago en mp_applied_payments:", ledgerErr.message);
      return {
        success: false,
        error: "No se pudo registrar el pago en este momento. Probá de nuevo en unos minutos.",
      };
    }
  } else {
    ledgerReserved = true;
  }

  const releaseLedger = async () => {
    if (!ledgerReserved) return;
    await supabaseAdmin.from("mp_applied_payments").delete().eq("payment_id", paymentIdStr).eq("user_id", userId);
  };

  const trustedMeta = getTrustedPlanMeta(authUser);
  const currentEndDate = profile?.plan_end_date || trustedMeta.plan_end_date;
  const creditedDays = getPlanDaysForPayment(payment);
  let newEndDate = calculateNewPlanEndDate(currentEndDate, creditedDays);
  const minEnd = minEndDate ? String(minEndDate).split("T")[0] : null;
  if (minEnd && /^\d{4}-\d{2}-\d{2}$/.test(minEnd) && minEnd > newEndDate) {
    newEndDate = minEnd;
  }
  // Suscripción activa: el vencimiento es el próximo cobro + días de gracia, nunca más allá
  const nextCharge = subscriptionNextPaymentDate ? String(subscriptionNextPaymentDate).split("T")[0] : null;
  if (nextCharge && /^\d{4}-\d{2}-\d{2}$/.test(nextCharge)) {
    const cap = addDaysToDate(nextCharge, SUBSCRIPTION_GRACE_DAYS);
    if (newEndDate > cap) newEndDate = cap;
    if (newEndDate < cap) newEndDate = cap;
  }
  const payerEmail =
    payment.payer?.email ||
    payment.additional_info?.payer?.email ||
    payment.payer_email ||
    null;
  const appliedPaymentIds = [...previousIds.filter((id) => id !== paymentIdStr), paymentIdStr].slice(
    -APPLIED_PAYMENT_IDS_LIMIT
  );

  // 5. Actualizar en Supabase Auth (app_metadata es la fuente de verdad del plan)
  if (authUser) {
    const today = new Date().toISOString().split("T")[0];
    // Fecha de inicio del plan pago: al pasar de prueba a mensual arranca con este pago (la fecha
    // de la prueba era la del alta). Si ya era mensual, se conserva la que tenía.
    const wasMonthly = authUser.app_metadata?.plan_type === "mensual";
    const paidAt = String(payment.date_approved || payment.date_created || "").split("T")[0];
    const planStart =
      (wasMonthly && authUser.app_metadata?.plan_start_date) ||
      (/^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? paidAt : today);
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...authUser.app_metadata,
        plan_type: "mensual",
        plan_start_date: planStart,
        plan_end_date: newEndDate,
        account_status: "activa",
        status: "active",
        last_payment_id: paymentIdStr,
        applied_payment_ids: appliedPaymentIds,
        mp_status: "approved",
        ...(payerEmail ? { mp_payer_email: payerEmail } : {}),
      },
      user_metadata: {
        ...(authUser.user_metadata || {}),
        plan_type: "mensual",
        plan_start_date: planStart,
        plan_end_date: newEndDate,
        account_status: "activa",
        status: "active",
        mp_status: "approved",
      },
    });

    if (authErr) {
      console.error(`[Mercado Pago] No se pudo acreditar el pago #${paymentIdStr} en Auth:`, authErr.message);
      await releaseLedger();
      return { success: false, error: "No se pudo acreditar el pago. Probá de nuevo en unos minutos." };
    }
  }

  // 6. Actualizar en profiles
  const profilePayload: Record<string, any> = {
    plan_type: "mensual",
    account_status: "activa",
    status: "active",
    plan_start_date:
      (authUser?.app_metadata?.plan_type === "mensual" && authUser?.app_metadata?.plan_start_date) ||
      String(payment.date_approved || payment.date_created || "").split("T")[0] ||
      new Date().toISOString().split("T")[0],
    plan_end_date: newEndDate,
    last_payment_id: paymentIdStr,
    updated_at: new Date().toISOString(),
  };

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update(profilePayload)
    .eq("id", userId);

  if (profileErr) {
    console.warn("[Mercado Pago] Advertencia al actualizar profiles:", profileErr.message);
    if (profileErr.message.includes("last_payment_id") || profileErr.message.includes("column")) {
      delete profilePayload.last_payment_id;
      await supabaseAdmin.from("profiles").update(profilePayload).eq("id", userId);
    }
  }

  console.log(
    `[Mercado Pago] Pago #${paymentIdStr} aplicado con éxito al usuario ${userId} (${creditedDays} días). Nueva fecha: ${newEndDate}`
  );

  return {
    success: true,
    newEndDate,
    paymentId: paymentIdStr,
  };
}

export interface SyncSubscriptionResult {
  synced: boolean;
  status?: string;
  plan_type?: string;
  plan_end_date?: string;
  payment_id?: string;
  mp_preapproval_id?: string;
  alreadyApplied?: boolean;
  error?: string;
  debug?: any;
}

/**
 * 3. Blindaje de Botones de "Sincronizar" (Anti-Abuso) - /api/mercadopago/sync-payment:
 * - Consulta fehacientemente contra:
 *   GET /v1/payments/search?external_reference=${userId}&sort=date_created&criteria=desc
 * - Si no existe pago aprobado, NO modifica la base de datos y retorna error.
 * - Si el último pago aprobado ya coincide con profiles.last_payment_id, rechaza la solicitud
 *   informando que el pago ya fue aplicado, impidiendo sumar días gratis duplicados.
 * - Solo si el pago aprobado es nuevo (id !== last_payment_id), aplica los 30 días y actualiza last_payment_id.
 */
export async function syncUserPaymentWithMercadoPago(options: {
  userId: string;
  paymentId?: string | null;
  email?: string | null;
  /**
   * true solo para un administrador o el service role. Una usuaria común solo puede
   * acreditar pagos hechos desde su propia cuenta (external_reference = su id) o, como
   * respaldo, pagos sin referencia hechos con el email de su cuenta y por el monto completo.
   */
  trusted?: boolean;
}): Promise<SyncSubscriptionResult> {
  const { userId, paymentId: explicitPaymentId, email: candidateInputEmail, trusted = false } = options;
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken || !userId) {
    return { synced: false, error: "Faltan credenciales del servidor o userId del usuario." };
  }

  const supabaseAdmin = getAdminClient();

  // Obtener perfil actual
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, last_payment_id, plan_type, plan_end_date")
    .eq("id", userId)
    .maybeSingle();

  const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const currentLastPaymentId =
    profile?.last_payment_id ||
    authRes?.user?.app_metadata?.last_payment_id;

  let approvedPayment: any = null;

  // A. Si se proporcionó un ID de pago o número de comprobante explícito (ej: 185634306746)
  if (explicitPaymentId && /^\d+$/.test(explicitPaymentId.trim())) {
    const operationId = explicitPaymentId.trim();
    try {
      let payData: any = null;
      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(operationId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (payRes.ok) {
        payData = await payRes.json();
      } else {
        // El comprobante de un cobro de suscripción trae el número del cobro (authorized_payment),
        // que no es el del pago: se busca el pago a partir de él.
        const apRes = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(operationId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (apRes.ok) {
          const ap = await apRes.json();
          const chargeId = ap?.payment?.id ? String(ap.payment.id) : "";
          if (chargeId) {
            const chargeRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(chargeId)}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (chargeRes.ok) {
              payData = await chargeRes.json();
              if (ap.preapproval_id && !payData?.metadata?.preapproval_id) {
                payData = { ...payData, metadata: { ...(payData.metadata || {}), preapproval_id: String(ap.preapproval_id) } };
              }
            }
          }
        }
      }
      if (payData) {
        if (payData.status === "approved") {
          // Si el pago tiene external_reference y es otro UUID distinto, rechazar
          const isUserUuid = (ref: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((ref || "").trim());

          const ref = String(payData.external_reference || "").trim();
          if (ref && isUserUuid(ref) && ref !== userId) {
            return {
              synced: false,
              error: `El pago #${payData.id} pertenece a otra cuenta de HABA.`,
            };
          }
          // Cobro de una suscripción: la referencia de la cuenta está en la suscripción, no en el pago
          let subscriptionRef = "";
          if (ref !== userId) {
            const subId = String(
              payData.metadata?.preapproval_id || payData.point_of_interaction?.transaction_data?.subscription_id || ""
            ).trim();
            if (subId) {
              try {
                const subRes = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subId)}`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (subRes.ok) subscriptionRef = String((await subRes.json())?.external_reference || "").trim();
              } catch {
                // sin dato de la suscripción
              }
            }
          }
          if (subscriptionRef && isUserUuid(subscriptionRef) && subscriptionRef !== userId) {
            return {
              synced: false,
              error: `El pago #${payData.id} pertenece a la suscripción de otra cuenta de HABA.`,
            };
          }
          // Un pago sin referencia a esta cuenta solo lo puede asignar un administrador
          if (!trusted && ref !== userId && subscriptionRef !== userId) {
            return {
              synced: false,
              error: `El pago #${payData.id} no está vinculado a tu cuenta. Escribinos y lo revisamos para acreditarlo.`,
            };
          }
          approvedPayment = payData;
        } else {
          return {
            synced: false,
            error: `El pago #${payData.id} se encuentra en estado '${payData.status}' (${payData.status_detail || "no aprobado"}).`,
          };
        }
      }
    } catch (err: any) {
      console.warn("[Mercado Pago Sync] Error consultando explicitPaymentId:", err);
    }
  }

  // B. Búsqueda principal por external_reference = userId
  if (!approvedPayment) {
    try {
      const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
        userId
      )}&sort=date_created&criteria=desc&limit=10`;

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = Array.isArray(searchData.results) ? searchData.results : [];
        const approvedFromSearch = results.find((p: any) => p.status === "approved");
        if (approvedFromSearch) {
          approvedPayment = approvedFromSearch;
        }
      }
    } catch (err: any) {
      console.warn("[Mercado Pago Sync] Error buscando por external_reference:", err);
    }
  }

  // C. Fallback: búsqueda en pagos recientes si no vino por external_reference pero coincide email
  if (!approvedPayment && candidateInputEmail && candidateInputEmail.includes("@")) {
    try {
      const candidateClean = candidateInputEmail.trim().toLowerCase();
      const recentRes = await fetch(
        `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        const results = Array.isArray(recentData.results) ? recentData.results : [];
        for (const p of results) {
          if (p.status !== "approved") continue;
          const pEmail = (p.payer?.email || p.additional_info?.payer?.email || "").toLowerCase();
          if (pEmail === candidateClean) {
            if (p.external_reference && p.external_reference !== userId) continue;
            // Sin referencia a la cuenta: exigir el precio completo del plan
            if (p.external_reference !== userId && !paymentCoversPlan(p)) continue;
            approvedPayment = p;
            break;
          }
        }
      }
    } catch (err: any) {
      console.warn("[Mercado Pago Sync] Error buscando por email reciente:", err);
    }
  }

  // Si no existe pago aprobado, NO modificar la base de datos y retornar error
  if (!approvedPayment) {
    return {
      synced: false,
      error:
        "No se encontró ningún cobro aprobado en Mercado Pago vinculado a tu cuenta. Si acabás de abonar, aguardá unos instantes y volvé a intentar.",
    };
  }

  const approvedPaymentIdStr = String(approvedPayment.id);

  // Si el último pago aprobado ya coincide con profiles.last_payment_id, rechazar la solicitud
  if (currentLastPaymentId && String(currentLastPaymentId) === approvedPaymentIdStr) {
    return {
      synced: false,
      alreadyApplied: true,
      payment_id: approvedPaymentIdStr,
      plan_type: profile?.plan_type || "mensual",
      plan_end_date: profile?.plan_end_date,
      error: `El último cobro (#${approvedPaymentIdStr}) ya fue acreditado a tu cuenta. Tu vigencia actual vence el ${
        profile?.plan_end_date || "próximamente"
      }.`,
    };
  }

  // Solo si el pago aprobado es nuevo (id !== last_payment_id), aplicar los 30 días
  // Si el pago pertenece a una suscripción activa, el vencimiento se alinea con su próximo cobro
  let syncNextPayment: string | null = null;
  let linkedPreapproval: any = null;
  const syncPreapprovalId = String(
    approvedPayment.metadata?.preapproval_id ||
      approvedPayment.point_of_interaction?.transaction_data?.subscription_id ||
      authRes?.user?.app_metadata?.mp_preapproval_id ||
      ""
  ).trim();
  if (syncPreapprovalId) {
    try {
      const preRes = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(syncPreapprovalId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (preRes.ok) {
        const pre = await preRes.json();
        const ref = String(pre?.external_reference || "").trim();
        if (pre?.status === "authorized" && (ref === userId || /haba/i.test(ref) || (trusted && !ref))) {
          syncNextPayment = pre.next_payment_date || null;
          linkedPreapproval = pre;
        }
      }
    } catch {
      // sin dato del próximo cobro: se acreditan los días del pago
    }
  }

  const applyResult = await applyApprovedPaymentToUser({
    payment: approvedPayment,
    userId,
    source: "sync",
    subscriptionNextPaymentDate: syncNextPayment,
  });

  if (!applyResult.success) {
    return {
      synced: false,
      alreadyApplied: applyResult.alreadyApplied,
      error: applyResult.error || "No se pudo aplicar el pago a la cuenta.",
    };
  }

  // Dejar la suscripción registrada en la cuenta (estado, id y próximo cobro)
  if (linkedPreapproval?.id) {
    try {
      const { data: freshRes } = await supabaseAdmin.auth.admin.getUserById(userId);
      const current = freshRes?.user?.app_metadata || {};
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...(current as Record<string, any>),
          mp_status: "authorized",
          mp_preapproval_id: String(linkedPreapproval.id),
          ...(linkedPreapproval.payer_email ? { mp_payer_email: String(linkedPreapproval.payer_email) } : {}),
          ...(syncNextPayment ? { mp_next_payment_date: syncNextPayment } : {}),
        },
      });
      await supabaseAdmin
        .from("profiles")
        .update({ mp_status: "authorized", mp_preapproval_id: String(linkedPreapproval.id), updated_at: new Date().toISOString() })
        .eq("id", userId);
    } catch (err) {
      console.warn("[Mercado Pago Sync] No se pudo registrar la suscripción en la cuenta:", err);
    }
  }

  return {
    synced: true,
    status: "approved",
    plan_type: "mensual",
    plan_end_date: applyResult.newEndDate,
    payment_id: approvedPaymentIdStr,
  };
}

/**
 * Alias de compatibilidad retrocompatible
 */
export async function syncUserSubscriptionWithMercadoPago(options: {
  userId: string;
  email?: string | null;
  preapprovalId?: string | null;
  paymentId?: string | null;
}): Promise<SyncSubscriptionResult> {
  return syncUserPaymentWithMercadoPago({
    userId: options.userId,
    paymentId: options.paymentId || options.preapprovalId,
    email: options.email,
  });
}

export interface OrphanPaymentCandidate {
  userId: string;
  fullName: string;
  businessName: string;
  email: string;
  accountNumber?: string | null;
  planEndDate?: string | null;
  planType?: string | null;
  accountStatus?: string | null;
  alreadyHasThisPayment: boolean;
  matchScore: number;
  matchReasons: string[];
}

export interface OrphanPaymentLookupResult {
  success: boolean;
  payment?: {
    id: string;
    status: string;
    status_detail?: string;
    date_created?: string;
    date_approved?: string;
    transaction_amount?: number;
    currency_id?: string;
    external_reference?: string | null;
    payment_method_id?: string;
    payment_type_id?: string;
    payer: {
      id?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      identification_number?: string;
      cardholder_name?: string;
    };
  };
  candidates?: OrphanPaymentCandidate[];
  error?: string;
}

/**
 * 4. Búsqueda y Asignación Asistida de Pagos Huérfanos en /admin:
 * - Consulta por paymentId en la API de Mercado Pago.
 * - Extrae datos del pagador (nombre, email de MP, monto, fecha).
 * - Cruza con Supabase para sugerir cuentas candidatas por similitud de nombre, apellido o fecha de vencimiento reciente.
 */
export async function lookupOrphanPayment(paymentId: string): Promise<OrphanPaymentLookupResult> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: "MP_ACCESS_TOKEN no configurado en el servidor." };
  }

  const cleanPaymentId = paymentId.trim();
  if (!cleanPaymentId) {
    return { success: false, error: "El ID de operación es obligatorio." };
  }

  try {
    const payRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(cleanPaymentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!payRes.ok) {
      const errText = await payRes.text();
      return { success: false, error: `No se encontró la operación #${cleanPaymentId} en Mercado Pago (${payRes.status}).` };
    }

    const payData = await payRes.json();
    const payerEmail = (
      payData.payer?.email ||
      payData.additional_info?.payer?.email ||
      ""
    ).trim().toLowerCase();

    const payerFirstName = (
      payData.payer?.first_name ||
      payData.additional_info?.payer?.first_name ||
      ""
    ).trim();

    const payerLastName = (
      payData.payer?.last_name ||
      payData.additional_info?.payer?.last_name ||
      ""
    ).trim();

    const cardholderName = (payData.card?.cardholder?.name || "").trim();

    const extractedPayment = {
      id: String(payData.id),
      status: payData.status,
      status_detail: payData.status_detail,
      date_created: payData.date_created,
      date_approved: payData.date_approved,
      transaction_amount: payData.transaction_amount,
      currency_id: payData.currency_id,
      external_reference: payData.external_reference || null,
      payment_method_id: payData.payment_method_id,
      payment_type_id: payData.payment_type_id,
      payer: {
        id: payData.payer?.id,
        email: payerEmail || undefined,
        first_name: payerFirstName || undefined,
        last_name: payerLastName || undefined,
        identification_number: payData.payer?.identification?.number,
        cardholder_name: cardholderName || undefined,
      },
    };

    // Consultar todos los perfiles en Supabase para cruce asistido
    const supabaseAdmin = getAdminClient();
    const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authMap = new Map((authList?.users || []).map((u) => [u.id, u]));

    const normalize = (str: string) =>
      (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const normCardholder = normalize(cardholderName);
    const normPayerFirst = normalize(payerFirstName);
    const normPayerLast = normalize(payerLastName);
    const normFullPayer = normalize(`${payerFirstName} ${payerLastName}`.trim());

    const candidates: OrphanPaymentCandidate[] = [];

    for (const p of profiles || []) {
      const authUser = authMap.get(p.id);
      const userMeta = authUser?.user_metadata || {};
      const appMeta = authUser?.app_metadata || {};

      const fullName = (p.full_name || userMeta.full_name || "").trim();
      const businessName = (p.business_name || userMeta.business_name || "").trim();
      const userEmail = (p.email || authUser?.email || "").trim().toLowerCase();
      const mpPayerEmail = (userMeta.mp_payer_email || appMeta.mp_payer_email || "").trim().toLowerCase();
      const businessEmail = (p.business_email || userMeta.business_email || "").trim().toLowerCase();
      const planEndDate = p.plan_end_date || appMeta.plan_end_date || null;
      const lastPaymentId = p.last_payment_id || appMeta.last_payment_id;

      const alreadyHasThisPayment = String(lastPaymentId) === String(payData.id);

      let score = 0;
      const reasons: string[] = [];

      // 1. Coincidencia exacta por external_reference (UUID)
      if (payData.external_reference && payData.external_reference === p.id) {
        score += 100;
        reasons.push("Referencia directa vinculada al usuario (external_reference)");
      }

      // 2. Coincidencia de Email
      if (payerEmail) {
        if (userEmail === payerEmail) {
          score += 80;
          reasons.push(`Email idéntico de cuenta (${userEmail})`);
        } else if (mpPayerEmail === payerEmail) {
          score += 75;
          reasons.push(`Coincide con email previo de Mercado Pago (${payerEmail})`);
        } else if (businessEmail === payerEmail) {
          score += 70;
          reasons.push(`Coincide con email comercial (${payerEmail})`);
        }
      }

      // 3. Coincidencia por Nombre y Apellido
      const normUserFull = normalize(fullName);

      if (normCardholder && normCardholder.length >= 3 && (normUserFull.includes(normCardholder) || normCardholder.includes(normUserFull))) {
        score += 50;
        reasons.push(`Nombre del titular de tarjeta coincide (${cardholderName})`);
      } else if (normFullPayer && normFullPayer.length >= 3 && (normUserFull.includes(normFullPayer) || normFullPayer.includes(normUserFull))) {
        score += 45;
        reasons.push(`Nombre de cuenta MP coincide (${payerFirstName} ${payerLastName})`);
      } else {
        if (normPayerLast && normPayerLast.length >= 3 && normUserFull.includes(normPayerLast)) {
          score += 30;
          reasons.push(`Apellido coincide (${payerLastName})`);
        }
        if (normPayerFirst && normPayerFirst.length >= 3 && normUserFull.includes(normPayerFirst)) {
          score += 20;
          reasons.push(`Nombre de pila coincide (${payerFirstName})`);
        }
      }

      // 4. Proximidad de Vencimiento Reciente (los pagos suelen ocurrir cerca del vencimiento)
      if (planEndDate) {
        const [y, m, d] = planEndDate.split("-").map((n: string) => parseInt(n, 10));
        const endDt = new Date(Date.UTC(y, m - 1, d));
        const nowDt = new Date();
        const diffDays = Math.round((endDt.getTime() - nowDt.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= -14 && diffDays <= 5) {
          score += 15;
          reasons.push(
            diffDays < 0
              ? `Plan vencido recientemente (hace ${Math.abs(diffDays)} días)`
              : diffDays === 0
              ? "Plan vence hoy"
              : `Plan próximo a vencer (en ${diffDays} días)`
          );
        }
      }

      if (alreadyHasThisPayment) {
        reasons.unshift("⚠️ ESTE PAGO YA FUE APLICADO A ESTA CUENTA");
      }

      candidates.push({
        userId: p.id,
        fullName: fullName || "Sin nombre",
        businessName: businessName || "",
        email: userEmail,
        accountNumber: p.account_number || userMeta.account_number || null,
        planEndDate: planEndDate,
        planType: p.plan_type || appMeta.plan_type || "prueba",
        accountStatus: p.account_status || appMeta.account_status || p.status || "active",
        alreadyHasThisPayment,
        matchScore: score,
        matchReasons: reasons,
      });
    }

    // Ordenar: primero mayor score, y si score es igual, alfabético
    candidates.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.fullName.localeCompare(b.fullName);
    });

    return {
      success: true,
      payment: extractedPayment,
      candidates,
    };
  } catch (err: any) {
    console.error("[Mercado Pago Lookup] Error:", err);
    return { success: false, error: err.message || "Error al consultar la API de Mercado Pago." };
  }
}

/**
 * Asigna un pago huérfano a un usuario específico desde el panel /admin
 */
export async function assignOrphanPayment(options: {
  paymentId: string;
  targetUserId: string;
}): Promise<ApplyPaymentResult> {
  const { paymentId, targetUserId } = options;
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return { success: false, error: "MP_ACCESS_TOKEN no configurado en el servidor." };
  }

  const cleanPaymentId = paymentId.trim();
  if (!cleanPaymentId || !targetUserId) {
    return { success: false, error: "Faltan parámetros paymentId o targetUserId." };
  }

  // 1. Consultar el pago en MP
  const payRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(cleanPaymentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!payRes.ok) {
    return { success: false, error: `No se pudo obtener el pago #${cleanPaymentId} de Mercado Pago.` };
  }

  const payment = await payRes.json();
  if (payment.status !== "approved") {
    return {
      success: false,
      error: `El pago #${cleanPaymentId} no está aprobado (estado actual: '${payment.status}').`,
    };
  }

  // 2. Aplicar pago al usuario con las reglas de vigencia y anti-abuso
  return applyApprovedPaymentToUser({
    payment,
    userId: targetUserId,
    source: "admin",
  });
}
