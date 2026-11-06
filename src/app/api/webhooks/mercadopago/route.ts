import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { applyApprovedPaymentToUser } from "@/lib/mercadopago";
import {
  ensurePlanEndDateAtLeast,
  findUserIdBySavedPreapproval,
  getPreapproval,
  isHabaUserId,
  saveSubscriptionState,
} from "@/lib/mp-subscriptions";

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

    // Cobro mensual de una suscripción (renovación automática)
    const isSubscriptionPayment =
      type === "subscription_authorized_payment" ||
      type === "authorized_payment" ||
      Boolean(action?.includes("authorized_payment"));

    const isStandardPayment =
      !isSubscriptionPayment &&
      (type === "payment" || action?.includes("payment") || url.searchParams.get("topic") === "payment");

    const isPreapproval =
      type === "subscription_preapproval" ||
      type === "preapproval" ||
      action?.includes("preapproval");

    if (!dataId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const supabaseAdmin = getAdminClient();

    // =========================================================================
    // Cobros de la suscripción automática: llegan con el id de la suscripción, cuya
    // external_reference es el id de la cuenta de HABA (suscripciones creadas desde HABA).
    // Las del link compartido anterior se vinculan por el email de pago.
    // =========================================================================
    if (isSubscriptionPayment) {
      const apRes = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(String(dataId))}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!apRes.ok) {
        console.error(`[Webhook Mercado Pago] Error ${apRes.status} consultando cobro de suscripción ${dataId}`);
        return NextResponse.json({ error: "No se pudo consultar el cobro en Mercado Pago" }, { status: 502 });
      }
      const authorizedPayment = await apRes.json();
      const preapprovalId = authorizedPayment.preapproval_id ? String(authorizedPayment.preapproval_id) : "";
      const chargeId = authorizedPayment.payment?.id ? String(authorizedPayment.payment.id) : "";
      if (!preapprovalId || !chargeId) {
        return NextResponse.json({ received: true, ignored: true, reason: "cobro sin pago asociado todavía" });
      }

      const preapproval = await getPreapproval(preapprovalId);
      const preRef = String(preapproval?.external_reference || "").trim();
      let userId: string | null = null;
      if (isHabaUserId(preRef)) {
        const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(preRef);
        if (userRes?.user) userId = userRes.user.id;
      }
      // Suscripción ya vinculada a una cuenta (las del link del plan no traen el id de la cuenta)
      if (!userId) userId = await findUserIdBySavedPreapproval(preapprovalId);
      if (!userId && (!preRef || /haba/i.test(preRef))) {
        userId = await findUserIdByPayerEmail(supabaseAdmin, preapproval?.payer_email);
      }
      if (!userId) {
        console.warn(`[Webhook Mercado Pago] Cobro de suscripción ${chargeId} sin cuenta de HABA (ref '${preRef}').`);
        return NextResponse.json({ received: true, orphan: true });
      }

      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(chargeId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!payRes.ok) {
        return NextResponse.json({ error: "No se pudo consultar el pago en Mercado Pago" }, { status: 502 });
      }
      const payment = await payRes.json();
      if (payment.status !== "approved") {
        console.log(`[Webhook Mercado Pago] Cobro de suscripción ${chargeId} en estado '${payment.status}'.`);
        return NextResponse.json({ received: true, status: payment.status });
      }

      const applyResult = await applyApprovedPaymentToUser({
        payment,
        userId,
        subscriptionNextPaymentDate: preapproval?.next_payment_date || null,
      });
      // Si el mismo pago ya se acreditó por otra notificación, igual se alinea el vencimiento
      // con la fecha del próximo cobro (solo extiende).
      if (!applyResult.success && applyResult.alreadyApplied) {
        await ensurePlanEndDateAtLeast(userId, preapproval?.next_payment_date || null);
      }
      await saveSubscriptionState(userId, {
        preapprovalId,
        status: preapproval?.status || "authorized",
        nextPaymentDate: preapproval?.next_payment_date || null,
      });

      return NextResponse.json({
        received: true,
        subscriptionPayment: true,
        applied: applyResult.success,
        alreadyApplied: applyResult.alreadyApplied || false,
      });
    }

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

        // Cobro de una suscripción avisado como pago común: el pago suele venir SIN referencia de la
        // cuenta (la referencia está en la suscripción). Se busca la suscripción a la que pertenece y
        // se toma de ahí el id de la cuenta y la fecha del próximo cobro.
        let subscriptionNextPayment: string | null = null;
        let subscription: any = null;
        const preapprovalId = String(
          payment.metadata?.preapproval_id || payment.point_of_interaction?.transaction_data?.subscription_id || ""
        ).trim();
        if (preapprovalId) {
          subscription = await getPreapproval(preapprovalId);
          const subRef = String(subscription?.external_reference || "").trim();
          if (userId) {
            // El pago ya trae el id de la cuenta: la suscripción solo aporta la fecha del próximo
            // cobro (el vencimiento queda ahí + gracia, sin sumar los días de prueba que tuviera)
            if (!subRef || subRef === userId || /haba/i.test(subRef)) {
              subscriptionNextPayment = subscription?.next_payment_date || null;
            } else {
              subscription = null;
            }
          } else if (isHabaUserId(subRef)) {
            const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(subRef);
            if (userRes?.user) {
              userId = userRes.user.id;
              subscriptionNextPayment = subscription?.next_payment_date || null;
            }
          } else {
            // Suscripción del link del plan (sin id de cuenta): primero la cuenta que ya la tiene
            // guardada; si no, por el email de quien pagó
            userId = await findUserIdBySavedPreapproval(preapprovalId);
            if (!userId && (!subRef || /haba/i.test(subRef))) {
              userId = await findUserIdByPayerEmail(supabaseAdmin, subscription?.payer_email);
            }
            if (userId) subscriptionNextPayment = subscription?.next_payment_date || null;
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
          subscriptionNextPaymentDate: subscriptionNextPayment,
        });

        if (!applyResult.success) {
          console.warn(`[Webhook Mercado Pago] Aviso al aplicar pago #${payment.id}: ${applyResult.error}`);
          if (applyResult.alreadyApplied && subscriptionNextPayment) {
            await ensurePlanEndDateAtLeast(userId, subscriptionNextPayment);
          }
        }
        if (subscription?.id) {
          await saveSubscriptionState(userId, {
            preapprovalId: String(subscription.id),
            status: subscription.status || "authorized",
            nextPaymentDate: subscriptionNextPayment,
          });
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

        if (preStatus === "authorized" && isHabaUserId(externalRef)) {
          const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(externalRef);
          if (authRes?.user) {
            await saveSubscriptionState(externalRef, {
              preapprovalId,
              status: "authorized",
              nextPaymentDate: preapproval.next_payment_date || null,
            });
          }
        }

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
