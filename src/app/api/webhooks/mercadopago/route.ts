import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { applyApprovedPaymentToUser } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

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
  if (!secret) return true;
  if (!xSignatureHeader) return false;

  const parts = xSignatureHeader.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.trim().split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

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
          "[Webhook Mercado Pago] Advertencia: x-signature no verificada. Se validará la autenticidad del recurso consultando la API de Mercado Pago."
        );
      }
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn("[Webhook Mercado Pago] MP_ACCESS_TOKEN no configurado.");
      return NextResponse.json({ received: true, note: "MP_ACCESS_TOKEN no configurado" });
    }

    const isStandardPayment =
      type === "payment" || action?.includes("payment") || url.searchParams.get("topic") === "payment";

    const isPreapproval =
      type === "subscription_preapproval" ||
      type === "preapproval" ||
      action?.includes("preapproval");

    if (!dataId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const supabaseAdmin = getAdminClient();

    // =========================================================================
    // 3. Notificaciones de tipo PAYMENT (Checkout Pro / Cobro Único mensual)
    // =========================================================================
    if (isStandardPayment) {
      const paymentId = String(dataId);
      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!payRes.ok) {
        console.error(`[Webhook Mercado Pago] Error ${payRes.status} al consultar pago ${paymentId}`);
        return NextResponse.json({ error: "No se pudo consultar el pago en Mercado Pago" }, { status: 502 });
      }

      const payment = await payRes.json();
      console.log(`[Webhook Mercado Pago] Pago #${payment.id} recibido con status '${payment.status}'`);

      if (payment.status === "approved") {
        const externalRef = (payment.external_reference || "").trim();

        // Validar formato UUID de Supabase (prohibido usar texto estático como "Haba suscripción mensual")
        const isUserUuid = (ref: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);

        let userId: string | null = null;

        if (externalRef && isUserUuid(externalRef)) {
          // Verificar que el usuario exista en Supabase
          const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(externalRef);
          if (userRes?.user) {
            userId = userRes.user.id;
          } else {
            const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("id", externalRef).maybeSingle();
            if (prof?.id) userId = prof.id;
          }
        }

        // Cobros de la suscripción anterior: llegan con la referencia fija "Haba suscripción mensual".
        // Solo para esa referencia se busca la cuenta por el email de pago (coincidencia única);
        // el registro mp_applied_payments impide acreditar el mismo pago dos veces.
        if (!userId && /haba/i.test(externalRef)) {
          userId = await findUserIdByPayerEmail(
            supabaseAdmin,
            payment.payer?.email || payment.additional_info?.payer?.email || payment.payer_email
          );
        }

        if (!userId) {
          console.warn(
            `[Webhook Mercado Pago] Pago #${payment.id} aprobado pero su external_reference ('${externalRef}') no corresponde a un UUID unívoco de usuario de HABA. Tratado como pago huérfano.`
          );
          return NextResponse.json({ received: true, orphan: true, external_reference: externalRef });
        }

        // Asignar vigencia de 30 días desde la fecha del pago (o sumando 30 días si su plan aún no venció)
        // y registrar last_payment_id en profiles
        const applyResult = await applyApprovedPaymentToUser({
          payment,
          userId,
        });

        if (!applyResult.success) {
          console.warn(`[Webhook Mercado Pago] Aviso al aplicar pago #${payment.id}: ${applyResult.error}`);
        }

        return NextResponse.json({
          received: true,
          applied: applyResult.success,
          alreadyApplied: applyResult.alreadyApplied,
          userId,
          newEndDate: applyResult.newEndDate,
          paymentId: payment.id.toString(),
        });
      }

      return NextResponse.json({ received: true, status: payment.status });
    }

    // =========================================================================
    // Soporte para Preapprovals Legados:
    // Si llega notificación de preapproval cancelado ('cancelled'), actualizar
    // mp_status = 'cancelled' en profiles SIN cortar el acceso hasta su plan_end_date.
    // =========================================================================
    if (isPreapproval) {
      const preapprovalId = String(dataId);
      const preRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (preRes.ok) {
        const preapproval = await preRes.json();
        const preStatus = preapproval.status;
        const externalRef = (preapproval.external_reference || "").trim();

        if (preStatus === "cancelled" || preStatus === "paused") {
          let targetUserId: string | null = null;

          if (externalRef) {
            const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("id", externalRef).maybeSingle();
            if (prof?.id) targetUserId = prof.id;
          }

          if (!targetUserId) {
            const { data: profByPre } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("mp_preapproval_id", preapprovalId)
              .maybeSingle();
            if (profByPre?.id) targetUserId = profByPre.id;
          }

          // Suscripciones del plan anterior: llegan con una referencia fija ("Haba suscripción mensual")
          // y sin el id de la cuenta. Se busca a la usuaria por el email con el que pagó.
          if (!targetUserId) {
            targetUserId = await findUserIdByPayerEmail(supabaseAdmin, preapproval.payer_email);
          }

          if (targetUserId) {
            // Actualizar mp_status SIN modificar plan_end_date: conserva los días que ya pagó
            await supabaseAdmin
              .from("profiles")
              .update({
                mp_status: preStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", targetUserId);

            // También actualizar en Auth
            const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
            if (authRes?.user) {
              await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                app_metadata: {
                  ...authRes.user.app_metadata,
                  mp_status: preStatus,
                },
              });
            }

            console.log(
              `[Webhook Mercado Pago] Preapproval legado ${preapprovalId} ${preStatus} para usuario ${targetUserId}. Acceso preservado hasta su plan_end_date.`
            );
          }
        }
      }

      return NextResponse.json({ received: true, preapproval: true });
    }

    return NextResponse.json({ received: true, ignored: true });
  } catch (err: any) {
    console.error("[Webhook Mercado Pago] Excepción procesando notificación:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Busca la cuenta de HABA por el email de quien pagó en Mercado Pago. Solo devuelve una cuenta
 * cuando la coincidencia es única (email de la cuenta o email de pago guardado por el servidor).
 */
async function findUserIdByPayerEmail(supabaseAdmin: any, rawEmail: unknown): Promise<string | null> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return null;

  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const matches = (users?.users || []).filter(
      (u: any) =>
        (u.email || "").toLowerCase() === email ||
        String(u.app_metadata?.mp_payer_email || "").toLowerCase() === email
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      console.warn(`[Webhook Mercado Pago] Email de pago ${email} coincide con varias cuentas; no se asigna.`);
    }
  } catch (err) {
    console.warn("[Webhook Mercado Pago] No se pudo buscar la cuenta por email de pago:", err);
  }
  return null;
}
