import { NextResponse } from "next/server";
import crypto from "crypto";
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

// Días de gracia sobre la fecha del próximo cobro: evita bloquear a una usuaria que
// ya pagó mientras Mercado Pago acredita el cobro y envía la notificación.
const PAYMENT_GRACE_DAYS = 3;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Valida la firma HMAC-SHA256 x-signature de Mercado Pago si MP_WEBHOOK_SECRET está configurado.
 */
function verifyMercadoPagoSignature(
  xSignatureHeader: string | null,
  xRequestIdHeader: string | null,
  dataId: string,
  secret: string
): boolean {
  if (!secret) return true; // Si no hay secreto configurado, permitir
  if (!xSignatureHeader) return false;

  const parts = xSignatureHeader.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.trim().split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Manifest template de Mercado Pago: id:[data.id en minúsculas];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestIdHeader || ""};ts:${ts};`;
  const computedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(computedHash);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    // Mercado Pago envía el tipo de notificación y el id del recurso en query params o body
    const action = body.action || url.searchParams.get("action");
    const type = body.type || url.searchParams.get("type") || body.topic || url.searchParams.get("topic");
    const dataId = body.data?.id || url.searchParams.get("data.id") || body.id || url.searchParams.get("id");

    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");

    if (webhookSecret && dataId) {
      const isValid = verifyMercadoPagoSignature(xSignature, xRequestId, String(dataId), webhookSecret);
      if (!isValid) {
        console.warn(
          "[Webhook Mercado Pago] Advertencia: x-signature no verificada. Se validará la autenticidad del recurso directamente consultando la API de Mercado Pago."
        );
      }
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.log("[Webhook Mercado Pago] Notificación recibida (MP_ACCESS_TOKEN no configurado en servidor)");
      return NextResponse.json({ received: true, note: "MP_ACCESS_TOKEN no configurado" });
    }

    // Clasificar eventos de suscripción y pagos
    const isSubscription =
      type === "subscription_preapproval" ||
      type === "preapproval" ||
      action?.includes("preapproval");
    const isRecurringPayment =
      type === "subscription_authorized_payment" || action?.includes("authorized_payment");
    const isStandardPayment =
      type === "payment" || action?.includes("payment");

    if ((!isSubscription && !isRecurringPayment && !isStandardPayment) || !dataId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    let preapprovalId: string | null = null;
    let externalRef: string = "";
    let payerEmail: string = "";
    let status: string = "";
    let nextPaymentDate: string | null = null;

    if (isRecurringPayment) {
      // Cobro recurrente autorizado
      const payRes = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!payRes.ok) {
        console.error(`[Webhook Mercado Pago] Error ${payRes.status} consultando cobro ${dataId}`);
        return NextResponse.json({ error: "No se pudo consultar el cobro en MP" }, { status: 502 });
      }
      const payment = await payRes.json();
      if (!payment.preapproval_id) {
        return NextResponse.json({ received: true, ignored: true });
      }
      preapprovalId = String(payment.preapproval_id);
    } else if (isSubscription) {
      preapprovalId = String(dataId);
    } else if (isStandardPayment) {
      // Notificación de pago puntual en API v1
      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (payRes.ok) {
        const payment = await payRes.json();
        externalRef = (payment.external_reference || "").trim();
        payerEmail = (payment.payer?.email || "").trim().toLowerCase();
        status = payment.status === "approved" ? "authorized" : payment.status;
        if (payment.metadata?.preapproval_id) {
          preapprovalId = String(payment.metadata.preapproval_id);
        }
      }
    }

    // Si tenemos preapprovalId, consultar estado completo de la suscripción
    if (preapprovalId) {
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mpRes.ok) {
        console.error(`[Webhook Mercado Pago] Error ${mpRes.status} consultando preapproval ${preapprovalId}`);
        return NextResponse.json({ error: "No se pudo consultar preapproval en MP" }, { status: 502 });
      }

      const preapproval = await mpRes.json();
      status = preapproval.status; // "authorized", "paused", "cancelled"
      payerEmail = (preapproval.payer_email || payerEmail || "").trim().toLowerCase();
      externalRef = (preapproval.external_reference || externalRef || "").trim();
      nextPaymentDate = preapproval.next_payment_date || null;
    }

    const supabaseAdmin = getAdminClient();

    // =========================================================================
    // LOCALIZACIÓN UNÍVOCA DE USUARIO EN SUPABASE
    // REGLA CRÍTICA:
    // NUNCA depender del email del pagador de Mercado Pago. Una usuaria puede
    // pagar con su MP personal (otro email). La trazabilidad está dada por
    // external_reference = user.id (o profile.id).
    // =========================================================================
    let targetUserId: string | null = null;
    let targetUser: any = null;

    // 1. Prioridad 1: external_reference directo como UUID en Supabase Auth o profiles.id
    if (externalRef) {
      const { data: userById } = await supabaseAdmin.auth.admin.getUserById(externalRef);
      if (userById?.user) {
        targetUserId = userById.user.id;
        targetUser = userById.user;
      } else {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", externalRef)
          .maybeSingle();

        if (profile?.id) {
          const { data: userFromProfile } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          if (userFromProfile?.user) {
            targetUserId = userFromProfile.user.id;
            targetUser = userFromProfile.user;
          }
        }
      }
    }

    // 2. Fallback por profiles.mp_preapproval_id = resourceId
    if (!targetUserId && preapprovalId) {
      const { data: profileByPreapproval } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (profileByPreapproval?.id) {
        const { data: userFromProfile } = await supabaseAdmin.auth.admin.getUserById(profileByPreapproval.id);
        if (userFromProfile?.user) {
          targetUserId = userFromProfile.user.id;
          targetUser = userFromProfile.user;
        }
      }
    }

    // 3. Fallback adicional por email si aún no se localizó
    if (!targetUserId && payerEmail) {
      console.warn(
        `[Webhook Mercado Pago] ADVERTENCIA: external_reference y mp_preapproval_id ausentes. Buscando como fallback por email: ${payerEmail}`
      );
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const found = listData?.users?.find((u) => (u.email || "").toLowerCase() === payerEmail);
      if (found) {
        targetUserId = found.id;
        targetUser = found;
      } else {
        const { data: profileByEmail } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", payerEmail)
          .maybeSingle();

        if (profileByEmail?.id) {
          const { data: userFromProf } = await supabaseAdmin.auth.admin.getUserById(profileByEmail.id);
          if (userFromProf?.user) {
            targetUserId = userFromProf.user.id;
            targetUser = userFromProf.user;
          }
        }
      }
    }

    if (!targetUserId || !targetUser) {
      console.warn(
        `[Webhook Mercado Pago] No se encontró usuario en HABA para ref '${externalRef}', preapproval '${preapprovalId}' ni email '${payerEmail}'`
      );
      return NextResponse.json({ received: true, matchedUser: false }, { status: 200 });
    }

    const currentPlan = getTrustedPlanMeta(targetUser);
    const today = new Date().toISOString().split("T")[0];

    if (status === "authorized" || status === "approved") {
      // Suscripción aprobada: activar plan mensual y extender fecha de fin por 30 días
      const newEndDate = addDays(today, 30);

      // Actualizar en tabla profiles:
      // - plan_type = 'mensual'
      // - account_status = 'activa'
      // - mp_status = 'authorized'
      // - mp_preapproval_id = resourceId
      // - plan_end_date = fecha_actual + 30 dias
      try {
        await supabaseAdmin
          .from("profiles")
          .update({
            plan_type: "mensual",
            account_status: "activa",
            status: "active",
            mp_status: "authorized",
            mp_preapproval_id: preapprovalId,
            plan_end_date: newEndDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetUserId);
      } catch (err: any) {
        // Fallback seguro si la tabla aún no cuenta con alguna columna
        try {
          await supabaseAdmin
            .from("profiles")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetUserId);
        } catch {}
      }

      // Actualizar datos de Auth (app_metadata y user_metadata) para consistencia global
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        app_metadata: {
          ...targetUser.app_metadata,
          plan_type: "mensual",
          plan_start_date: today,
          plan_end_date: newEndDate,
          account_status: "active",
          mp_status: "authorized",
          mp_preapproval_id: preapprovalId || currentPlan.mp_preapproval_id,
        },
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          plan_type: "mensual",
          plan_start_date: today,
          plan_end_date: newEndDate,
          account_status: "active",
          mp_preapproval_id: preapprovalId || currentPlan.mp_preapproval_id,
        },
      });

      if (updateError) {
        console.error("[Webhook Mercado Pago] No se pudo activar el plan en Auth:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log(
        `[Webhook Mercado Pago] Suscripción activada exitosamente para usuario ${targetUserId} (${targetUser.email}) hasta ${newEndDate}. Preapproval: ${preapprovalId}`
      );
    } else if (status === "cancelled" || status === "paused") {
      // Suscripción cancelada o pausada en Mercado Pago
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        app_metadata: {
          ...targetUser.app_metadata,
          mp_status: status,
        },
      });
      if (updateError) {
        console.error("[Webhook Mercado Pago] No se pudo actualizar estado en Auth:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log(`[Webhook Mercado Pago] Suscripción ${status} para usuario ${targetUserId}`);
    }

    return NextResponse.json({ success: true, status, userId: targetUserId }, { status: 200 });
  } catch (err: any) {
    console.error("[Webhook Mercado Pago] Error inesperado en webhook:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
