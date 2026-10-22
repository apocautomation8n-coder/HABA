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
  preapprovalId?: string | null;
}): Promise<SyncSubscriptionResult> {
  const { userId, email, preapprovalId: explicitPreapprovalId } = options;
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

    // 1. Obtener listado de usuarios de Supabase para verificaciones de seguridad cruzadas
    const { data: allUsersRes } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const allUsers = allUsersRes?.users || [];

    // Mapeo de suscripciones ya activas en Supabase: mp_preapproval_id -> userId
    const existingSubOwners: Record<string, string> = {};
    for (const u of allUsers) {
      if (u.id === userId) continue;
      const activePreapproval =
        u.app_metadata?.plan_type === "mensual"
          ? u.app_metadata?.mp_preapproval_id || u.user_metadata?.mp_preapproval_id
          : null;
      if (activePreapproval) {
        existingSubOwners[activePreapproval] = u.id;
      }
    }



    const candidateEmails = Array.from(
      new Set(
        [
          targetEmail,
          targetUser.email,
          targetUser.user_metadata?.business_email,
          targetUser.user_metadata?.email,
          targetUser.user_metadata?.mp_payer_email,
          targetUser.app_metadata?.mp_payer_email,
        ]
          .filter(Boolean)
          .map((e) => (e as string).trim().toLowerCase())
      )
    );

    // Función de seguridad estricta:
    // Una suscripción o pago SOLO es válido para este usuario si el correo del pagador
    // coincide con candidateEmails y no pertenece a otro usuario de HABA.
    const isValidMatch = async (p: any): Promise<boolean> => {
      if (!p) return false;
      const validStatus =
        p.status === "authorized" ||
        p.status === "pending" ||
        p.status === "paused" ||
        p.status === "approved" ||
        p.status === "in_process";
      if (!validStatus) return false;

      // REGLA DE SEGURIDAD 2: Si la suscripción en Mercado Pago ya tiene external_reference de otro usuario de HABA:
      if (p.external_reference && p.external_reference !== userId) {
        console.warn(
          `[Mercado Pago Sync] Suscripción ${p.id} pertenece a otro usuario (${p.external_reference}). Rechazada para ${userId}.`
        );
        return false;
      }

      // REGLA DE SEGURIDAD 3: Si la suscripción ya está asignada a otra cuenta de HABA en Supabase:
      if (existingSubOwners[p.id] && existingSubOwners[p.id] !== userId) {
        console.warn(
          `[Mercado Pago Sync] Suscripción ${p.id} ya está activa en otra cuenta de Supabase (${existingSubOwners[p.id]}). Rechazada para ${userId}.`
        );
        return false;
      }

      let pEmail = (
        p.payer_email ||
        p.payer?.email ||
        p.additional_info?.payer?.email ||
        ""
      ).trim().toLowerCase();

      // Si p no trae email directo en el objeto pero tiene id, consultar el detalle completo de Mercado Pago
      if (!pEmail && p.id) {
        try {
          const isNumeric = /^\d+$/.test(String(p.id));
          const detailUrl = isNumeric
            ? `https://api.mercadopago.com/v1/payments/${p.id}`
            : `https://api.mercadopago.com/preapproval/${p.id}`;

          const detailRes = await fetch(detailUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            pEmail = (
              detailData.payer_email ||
              detailData.payer?.email ||
              detailData.additional_info?.payer?.email ||
              ""
            ).trim().toLowerCase();
          }
        } catch {}
      }

      // REGLA FUNDAMENTAL DE SEGURIDAD:
      // Para validar una suscripción, el email del pagador DEBE existir y DEBE coincidir
      // con alguno de los emails candidatos del usuario (su email de cuenta o el alternativo provisto).
      // BAJO NINGÚN CONCEPTO se aprueba una suscripción sin email verificado o con email de otra persona.
      if (!pEmail || !candidateEmails.includes(pEmail)) {
        // Si tenía un external_reference erróneo asignado a este usuario, limpiarlo en Mercado Pago
        if (p.external_reference === userId) {
          console.warn(
            `[Mercado Pago Sync] Desvinculando ${p.id}: external_reference coincide pero payer_email (${pEmail || "desconocido"}) no pertenece a ${userId}.`
          );
          try {
            fetch(`https://api.mercadopago.com/preapproval/${p.id}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ external_reference: "" }),
            }).catch(() => {});
          } catch {}
        }
        return false;
      }

      return true;
    };

    // Prioridad 0: Si viene un preapprovalId explícito (por ejemplo al volver de Mercado Pago en la URL)
    if (explicitPreapprovalId) {
      try {
        const directRes = await fetch(
          `https://api.mercadopago.com/preapproval/${explicitPreapprovalId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (directRes.ok) {
          const directData = await directRes.json();
          const validStatus =
            directData.status === "authorized" ||
            directData.status === "pending" ||
            directData.status === "paused" ||
            directData.status === "approved" ||
            directData.status === "in_process";

          const notOwnedByOther =
            !existingSubOwners[directData.id] ||
            existingSubOwners[directData.id] === userId;

          const notRefOther =
            !directData.external_reference ||
            directData.external_reference === userId;

          if (validStatus && notOwnedByOther && notRefOther) {
            preapproval = directData;
            const foundEmail = (
              directData.payer_email ||
              directData.payer?.email ||
              ""
            ).trim().toLowerCase();
            if (foundEmail && !candidateEmails.includes(foundEmail)) {
              candidateEmails.push(foundEmail);
            }
            try {
              fetch(`https://api.mercadopago.com/preapproval/${directData.id}`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ external_reference: userId }),
              }).catch(() => {});
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error consultando por preapprovalId explícito:", e);
      }
    }

    // 2. Buscar preapproval o pago en Mercado Pago:

    // A. Prioridad 0: Por ID directo de preapproval si el usuario ya tiene uno guardado
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
          if (await isValidMatch(directData)) {
            preapproval = directData;
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error consultando por preapprovalId guardado:", e);
      }
    }

    // B. Prioridad 1: Por external_reference = userId
    if (!preapproval) {
      try {
        const searchRes = await fetch(
          `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(userId)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData.results) && searchData.results.length > 0) {
            for (const p of searchData.results) {
              if (await isValidMatch(p)) {
                preapproval = p;
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error buscando por external_reference:", e);
      }
    }

    // C. Prioridad 2: Buscar cobros y pagos por cada email candidato en /v1/payments (rápido, indexado y con payer.email directo)
    let paymentApproved: any = null;
    if (!preapproval) {
      for (const cEmail of candidateEmails) {
        if (preapproval || paymentApproved) break;
        try {
          const payEmailRes = await fetch(
            `https://api.mercadopago.com/v1/payments/search?payer.email=${encodeURIComponent(cEmail)}&sort=date_created&criteria=desc&limit=20`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (payEmailRes.ok) {
            const payData = await payEmailRes.json();
            if (Array.isArray(payData.results) && payData.results.length > 0) {
              for (const p of payData.results) {
                if (await isValidMatch(p)) {
                  paymentApproved = p;
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn("[Mercado Pago Sync] Error buscando pago por payer.email:", e);
        }
      }
    }

    // D. Prioridad 3: Buscar en las suscripciones del Plan Maestro de HABA (más recientes primero)
    const masterPlanId =
      process.env.MP_PREAPPROVAL_PLAN_ID ||
      process.env.MP_PLAN_ID ||
      "bdef7d4f90264c1ca7be8c8569331414";

    if (!preapproval && !paymentApproved && masterPlanId) {
      try {
        const planRes = await fetch(
          `https://api.mercadopago.com/preapproval/search?preapproval_plan_id=${encodeURIComponent(masterPlanId)}&sort=date_created&criteria=desc&limit=30`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (planRes.ok) {
          const planData = await planRes.json();
          if (Array.isArray(planData.results) && planData.results.length > 0) {
            for (const p of planData.results) {
              if (await isValidMatch(p)) {
                preapproval = p;
                try {
                  fetch(`https://api.mercadopago.com/preapproval/${p.id}`, {
                    method: "PUT",
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ external_reference: userId }),
                  }).catch(() => {});
                } catch {}
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error buscando por plan maestro:", e);
      }
    }

    // E. Prioridad 4: Escanear las suscripciones más recientes de toda la cuenta MP (limit 30)
    if (!preapproval && !paymentApproved) {
      try {
        const recentRes = await fetch(
          `https://api.mercadopago.com/preapproval/search?sort=date_created&criteria=desc&limit=30`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          if (Array.isArray(recentData.results) && recentData.results.length > 0) {
            for (const p of recentData.results) {
              if (await isValidMatch(p)) {
                preapproval = p;
                try {
                  fetch(`https://api.mercadopago.com/preapproval/${p.id}`, {
                    method: "PUT",
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ external_reference: userId }),
                  }).catch(() => {});
                } catch {}
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error buscando suscripciones globales:", e);
      }
    }

    // F. Prioridad 5: Escanear los cobros y pagos más recientes globales de Mercado Pago (/v1/payments)
    if (!preapproval && !paymentApproved) {
      try {
        const payRes = await fetch(
          `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (payRes.ok) {
          const payData = await payRes.json();
          if (Array.isArray(payData.results) && payData.results.length > 0) {
            for (const p of payData.results) {
              if (await isValidMatch(p)) {
                paymentApproved = p;
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Mercado Pago Sync] Error buscando pagos recientes:", e);
      }
    }

    if (!preapproval && !paymentApproved) {
      return { synced: false, error: "No se encontró suscripción autorizada en Mercado Pago para este usuario." };
    }

    const currentPlan = getTrustedPlanMeta(targetUser);
    const today = new Date().toISOString().split("T")[0];
    const preapprovalId =
      preapproval?.id ||
      paymentApproved?.metadata?.preapproval_id ||
      (paymentApproved?.id ? String(paymentApproved.id) : null) ||
      targetUser.app_metadata?.mp_preapproval_id ||
      targetUser.user_metadata?.mp_preapproval_id ||
      currentPlan.mp_preapproval_id ||
      null;

    // REGLA DE SEGURIDAD 4: Salvaguarda final contra reasignación de suscripciones activas
    if (preapprovalId && existingSubOwners[preapprovalId] && existingSubOwners[preapprovalId] !== userId) {
      const ownerUser = allUsers.find((u) => u.id === existingSubOwners[preapprovalId]);
      return {
        synced: false,
        error: `Esta suscripción ya se encuentra activa en la cuenta de ${ownerUser?.email || "otro usuario"}. Cada suscripción mensual es individual y válida para una sola cuenta.`,
      };
    }

    let newEndDate: string;

    const nextPaymentDateStr = preapproval?.next_payment_date
      ? preapproval.next_payment_date.split("T")[0]
      : null;

    if (currentPlan.plan_type === "mensual") {
      // REGLA CRÍTICA DE NEGOCIO:
      // Si la usuaria YA tiene el Plan Mensual vigente, la sincronización NUNCA DEBE SUMAR DÍAS.
      // Preservar estrictamente la fecha de fin que ya tiene.
      newEndDate = currentPlan.plan_end_date || addDays(today, 30);
    } else {
      // Solo en caso de que el plan NO muestre mensual (estaba en prueba o vencido):
      // Activar el plan mensual por primera vez (30 días exactos desde hoy)
      newEndDate = addDays(today, 30);
    }

    // Salvaguarda: una sincronización nunca acorta una vigencia ya acreditada
    if (currentPlan.plan_end_date && currentPlan.plan_end_date > newEndDate) {
      newEndDate = currentPlan.plan_end_date;
    }

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
        mp_payer_email: preapproval?.payer_email || targetUser.app_metadata?.mp_payer_email,
      },
      user_metadata: {
        ...(targetUser.user_metadata || {}),
        plan_type: "mensual",
        plan_start_date: currentPlan.plan_type === "mensual" ? currentPlan.plan_start_date : today,
        plan_end_date: newEndDate,
        account_status: "active",
        mp_status: "authorized",
        mp_preapproval_id: preapprovalId || currentPlan.mp_preapproval_id,
        mp_payer_email: preapproval?.payer_email || targetUser.user_metadata?.mp_payer_email,
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
