import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { calculatePlanEndDate } from "@/lib/plan-helpers";

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

  // Mercado Pago manifest template
  const manifest = `id:${dataId};request-id:${xRequestIdHeader || ""};ts:${ts};`;
  const computedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return computedHash === v1;
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
        console.warn("[Webhook Mercado Pago] Firma x-signature inválida rechazada");
        return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
      }
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.log("[Webhook Mercado Pago] Notificación recibida (MP_ACCESS_TOKEN no configurado en servidor)");
      return NextResponse.json({ received: true, note: "MP_ACCESS_TOKEN no configurado" });
    }

    // Procesar únicamente suscripciones (preapproval)
    const isSubscription =
      type === "subscription_preapproval" ||
      type === "preapproval" ||
      action?.includes("preapproval");

    if (!isSubscription || !dataId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    // Consultar estado de la suscripción en la API de Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mpRes.ok) {
      console.error(`[Webhook Mercado Pago] Error ${mpRes.status} consultando preapproval ${dataId}`);
      return NextResponse.json({ error: "No se pudo consultar preapproval en MP" }, { status: 502 });
    }

    const preapproval = await mpRes.json();
    const status = preapproval.status; // "authorized", "paused", "cancelled"
    const payerEmail = (preapproval.payer_email || "").trim().toLowerCase();
    const externalRef = (preapproval.external_reference || "").trim();
    const nextPaymentDate = preapproval.next_payment_date;

    const supabaseAdmin = getAdminClient();

    // 1. Localizar al usuario en Supabase (por external_reference [userId o accountNumber] o por payer_email)
    let targetUserId: string | null = null;
    let targetUser: any = null;

    if (externalRef) {
      const { data: userById } = await supabaseAdmin.auth.admin.getUserById(externalRef);
      if (userById?.user) {
        targetUserId = userById.user.id;
        targetUser = userById.user;
      }
    }

    if (!targetUserId && payerEmail) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const found = listData?.users?.find(
        (u) => (u.email || "").toLowerCase() === payerEmail
      );
      if (found) {
        targetUserId = found.id;
        targetUser = found;
      }
    }

    if (!targetUserId || !targetUser) {
      console.warn(`[Webhook Mercado Pago] No se encontró usuario para email ${payerEmail} / ref ${externalRef}`);
      return NextResponse.json({ received: true, matchedUser: false });
    }

    const currentMeta = targetUser.user_metadata || {};
    const today = new Date().toISOString().split("T")[0];

    if (status === "authorized") {
      // Suscripción aprobada: activar plan mensual y extender fecha de fin
      const newEndDate = nextPaymentDate
        ? nextPaymentDate.split("T")[0]
        : calculatePlanEndDate(today, "mensual");

      const updatedMeta = {
        ...currentMeta,
        plan_type: "mensual",
        plan_start_date: currentMeta.plan_start_date || today,
        plan_end_date: newEndDate,
        account_status: "active",
        mp_status: "authorized",
        mp_preapproval_id: String(dataId),
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: updatedMeta,
      });

      try {
        await supabaseAdmin
          .from("profiles")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetUserId);
      } catch {
        // ignore
      }

      console.log(`[Webhook Mercado Pago] Suscripción activada con éxito para usuario ${targetUserId} hasta ${newEndDate}`);
    } else if (status === "cancelled" || status === "paused") {
      // Suscripción cancelada o pausada
      const updatedMeta = {
        ...currentMeta,
        mp_status: status,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: updatedMeta,
      });

      console.log(`[Webhook Mercado Pago] Suscripción ${status} para usuario ${targetUserId}`);
    }

    return NextResponse.json({ success: true, status, userId: targetUserId });
  } catch (err: any) {
    console.error("[Webhook Mercado Pago] Error inesperado:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
