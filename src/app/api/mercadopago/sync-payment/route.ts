import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncUserPaymentWithMercadoPago } from "@/lib/mercadopago";
import { syncUserSubscription } from "@/lib/mp-subscriptions";
import { checkIsAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleSyncPayment(request);
}

export async function GET(request: Request) {
  return handleSyncPayment(request);
}

async function handleSyncPayment(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const authHeader = request.headers.get("Authorization");
    const isServiceRole =
      authHeader &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

    let user: any = null;

    if (!isServiceRole) {
      const supabase = await createServerClient();
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      user = authUser;
    }

    const requestedUserId = url.searchParams.get("userId") || body.userId;
    const rawEmail = String(body.email || url.searchParams.get("email") || "").trim();
    // Un número en el campo del correo es el número de operación del comprobante
    const emailIsOperation = /^\d{6,}$/.test(rawEmail);
    const paymentId =
      body.payment_id ||
      url.searchParams.get("payment_id") ||
      body.collection_id ||
      url.searchParams.get("collection_id") ||
      (emailIsOperation ? rawEmail : undefined);

    const trusted = Boolean(isServiceRole) || checkIsAdmin(user);
    let targetUserId = user?.id || requestedUserId;
    // Una usuaria común solo puede buscar pagos con el email de su propia cuenta:
    // un email enviado en la solicitud permitiría reclamar el pago de otra persona.
    let candidateEmail = trusted
      ? body.email || url.searchParams.get("email") || user?.email
      : user?.email;

    // Solo un administrador o service_role puede sincronizar la cuenta de otra persona
    if (requestedUserId && requestedUserId !== user?.id) {
      if (!trusted) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      targetUserId = requestedUserId;
      candidateEmail = url.searchParams.get("email") || body.email || undefined;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId no especificado" }, { status: 400 });
    }

    // 3. Blindaje Anti-Abuso:
    // - Valida fehacientemente contra GET /v1/payments/search?external_reference=${userId}
    // - Si no existe pago aprobado, NO modifica la base de datos y retorna error
    // - Si el último pago aprobado ya coincide con profiles.last_payment_id, rechaza la solicitud
    // - Solo si el pago aprobado es nuevo (id !== last_payment_id), aplica los 30 días y actualiza last_payment_id
    // Suscripción automática: registrar su estado (al volver del link de Mercado Pago el aviso
    // del webhook puede no haber llegado todavía)
    let subscription: { status: string | null; activated: boolean } = { status: null, activated: false };
    try {
      subscription = await syncUserSubscription(targetUserId);
    } catch (subErr) {
      console.warn("[API sync-payment] No se pudo sincronizar la suscripción:", subErr);
    }

    const result = await syncUserPaymentWithMercadoPago({
      userId: targetUserId,
      paymentId: paymentId ? String(paymentId) : undefined,
      email: candidateEmail,
      trusted,
    });

    // Suscripción recién activada y el cobro todavía no figura: igual es un éxito para la usuaria
    if (!result.synced && subscription.status === "authorized") {
      return NextResponse.json({
        ...result,
        synced: true,
        status: "authorized",
        plan_type: "mensual",
        subscription: subscription.status,
        error: undefined,
      });
    }

    return NextResponse.json({ ...result, subscription: subscription.status });
  } catch (err: any) {
    console.error("[API sync-payment] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

