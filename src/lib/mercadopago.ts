import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { calculatePlanEndDate, getTrustedPlanMeta } from "@/lib/plan-helpers";

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

const PAYMENT_GRACE_DAYS = 3;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

export interface SyncSubscriptionResult {
  synced: boolean;
  status?: string;
  plan_type?: string;
  plan_end_date?: string;
  mp_preapproval_id?: string;
  error?: string;
}

/**
 * Consulta en la API de Mercado Pago las suscripciones o cobros aprobados para un usuario
 * e impacta de inmediato en Supabase (Auth app_metadata, user_metadata y profiles).
 *
 * Funciona como salvaguarda ante demoras o fallas en el webhook de Mercado Pago.
 */
export async function syncUserSubscriptionWithMercadoPago(options: {
  userId: string;
  email?: string | null;
  payerEmail?: string | null;
  preapprovalId?: string | null;
}): Promise<SyncSubscriptionResult> {
  const { userId, email, payerEmail, preapprovalId: explicitPreapprovalId } = options;
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken || !userId) {
    return { synced: false, error: "Faltan credenciales o userId" };
  }

  const supabaseAdmin = getAdminClient();

  try {
    // 1. Obtener datos actuales del usuario en Supabase
    const { data: userRes, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchErr || !userRes?.user) {
      return { synced: false, error: "Usuario no encontrado en Supabase: " + fetchErr?.message };
    }
    const targetUser = userRes.user;
    const targetEmail = (email || targetUser.email || "").trim().toLowerCase();

    let preapproval: any = null;

    // Prioridad 0: Por ID directo de preapproval si fue explícitamente provisto
    if (explicitPreapprovalId) {
      try {
        const directRes = await fetch(
          `https://api.mercadopago.com/preapproval/${explicitPreapprovalId.trim()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData && (directData.status === "authorized" || directData.status === "paused")) {
            preapproval = directData;
            try {
              fetch(`https://api.mercadopago.com/preapproval/${directData.id}`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ external_reference: userId }),
              }).catch(() => {});
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error consultando explicitPreapprovalId:", e);
      }
    }

    // 2. Buscar preapproval en Mercado Pago:
    // Prioridad 1: Por external_reference = userId
    if (!preapproval) {
      try {
        const searchRes = await fetch(
          `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(
            userId
          )}&status=authorized&sort=date_created&criteria=desc&limit=50`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData.results) && searchData.results.length > 0) {
            const matched = searchData.results.find(
              (p: any) => p.external_reference === userId
            );
            if (matched) {
              preapproval = matched;
            }
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error buscando por external_reference:", e);
      }
    }

    // Prioridad 2: Por ID directo de preapproval si el usuario ya tiene uno guardado
    const savedPreapprovalId = targetUser.app_metadata?.mp_preapproval_id;
    if (!preapproval && savedPreapprovalId) {
      try {
        const directRes = await fetch(
          `https://api.mercadopago.com/preapproval/${savedPreapprovalId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData && (directData.status === "authorized" || directData.status === "paused")) {
            preapproval = directData;
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error consultando por preapprovalId guardado:", e);
      }
    }

    // Prioridad 3: Fallback para suscripciones por email del pagador (incluye payerEmail explícito si pagó con otra cuenta)
    if (!preapproval) {
      const candidateEmails = Array.from(
        new Set(
          [
            payerEmail,
            targetEmail,
            targetUser.email,
            targetUser.user_metadata?.business_email,
            targetUser.user_metadata?.email,
          ]
            .filter(Boolean)
            .map((e) => (e as string).trim().toLowerCase())
        )
      );

      for (const cEmail of candidateEmails) {
        if (preapproval) break;
        try {
          const emailSearchRes = await fetch(
            `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(
              cEmail
            )}&status=authorized&sort=date_created&criteria=desc&limit=50`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (emailSearchRes.ok) {
            const emailData = await emailSearchRes.json();
            if (Array.isArray(emailData.results) && emailData.results.length > 0) {
              // Tomar la suscripción autorizada más reciente que esté sin external_reference o asignada a este usuario
              const candidate = emailData.results.find(
                (p: any) => !p.external_reference || p.external_reference === userId
              );
              if (candidate) {
                preapproval = candidate;
                // Vincular formalmente en Mercado Pago para que quede fijado con el external_reference del usuario
                try {
                  fetch(`https://api.mercadopago.com/preapproval/${candidate.id}`, {
                    method: "PUT",
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ external_reference: userId }),
                  }).catch(() => {});
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch (e) {
          console.warn("[Mercado Pago Sync] Error buscando por email fallback:", e);
        }
      }
    }

    // 4. Si no hay preapproval recurrente, buscar pagos autorizados recientes
    let paymentApproved: any = null;
    if (!preapproval) {
      try {
        const paySearchRes = await fetch(
          `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
            userId
          )}&status=approved&sort=date_created&criteria=desc`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (paySearchRes.ok) {
          const payData = await paySearchRes.json();
          if (Array.isArray(payData.results) && payData.results.length > 0) {
            paymentApproved = payData.results[0];
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error buscando pagos por external_reference:", e);
      }
    }

    if (!preapproval && !paymentApproved) {
      return { synced: false, error: "No se encontró suscripción autorizada en Mercado Pago" };
    }

    const currentPlan = getTrustedPlanMeta(targetUser);
    const today = new Date().toISOString().split("T")[0];
    const preapprovalId = preapproval?.id || paymentApproved?.metadata?.preapproval_id || null;

    // Detectar si se trata de una NUEVA suscripción o cobro recurrente adicional
    const isNewPreapproval = Boolean(
      preapprovalId &&
        currentPlan.mp_preapproval_id &&
        preapprovalId !== currentPlan.mp_preapproval_id
    );
    const hasActiveFuturePlan = Boolean(
      currentPlan.plan_end_date && currentPlan.plan_end_date > today
    );

    // Si el usuario ya tenía días pagos vigentes y realizó una nueva suscripción o cobro adicional, es ACUMULATIVO
    const baseDate =
      hasActiveFuturePlan && (isNewPreapproval || paymentApproved)
        ? currentPlan.plan_end_date!
        : today;

    const nextPaymentDate = preapproval?.next_payment_date;
    // Garantizar que la suscripción mensual otorgue al menos 30 días completos desde la fecha base
    const minMonthEndDate = addDays(baseDate, 30);
    const mpEndDate = nextPaymentDate
      ? addDays(nextPaymentDate.split("T")[0], PAYMENT_GRACE_DAYS)
      : null;

    // Asignar al menos 30 días completos (acumulativos si aplica)
    const calculatedEndDate =
      mpEndDate && mpEndDate > minMonthEndDate ? mpEndDate : minMonthEndDate;

    // Salvaguarda: una sincronización NUNCA debe reducir o acortar una vigencia ya acreditada
    const newEndDate =
      currentPlan.plan_end_date && currentPlan.plan_end_date > calculatedEndDate
        ? currentPlan.plan_end_date
        : calculatedEndDate;

    // 5. Impactar en Supabase Auth (app_metadata y user_metadata)
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...targetUser.app_metadata,
        plan_type: "mensual",
        plan_start_date: currentPlan.plan_type === "mensual" ? currentPlan.plan_start_date : today,
        plan_end_date: newEndDate,
        account_status: "active",
        mp_status: "authorized",
        mp_preapproval_id: preapprovalId || currentPlan.mp_preapproval_id,
      },
      user_metadata: {
        ...(targetUser.user_metadata || {}),
        plan_type: "mensual",
        plan_start_date: currentPlan.plan_type === "mensual" ? currentPlan.plan_start_date : today,
        plan_end_date: newEndDate,
        account_status: "active",
      },
    });

    if (updateAuthErr) {
      console.error("[Mercado Pago Sync] Error actualizando Auth:", updateAuthErr.message);
      return { synced: false, error: updateAuthErr.message };
    }

    // 6. Impactar en public.profiles
    try {
      await supabaseAdmin
        .from("profiles")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch (err: any) {
      console.warn("[Mercado Pago Sync] Error actualizando profiles:", err?.message);
    }

    console.log(
      `[Mercado Pago Sync] Plan Mensual activado con éxito para ${userId} (${targetEmail}) hasta ${newEndDate}`
    );

    return {
      synced: true,
      status: "authorized",
      plan_type: "mensual",
      plan_end_date: newEndDate,
      mp_preapproval_id: preapprovalId,
    };
  } catch (err: any) {
    console.error("[Mercado Pago Sync] Error inesperado:", err);
    return { synced: false, error: err.message };
  }
}
