import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncUserPaymentWithMercadoPago } from "@/lib/mercadopago";
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
    const paymentId =
      body.payment_id ||
      url.searchParams.get("payment_id") ||
      body.collection_id ||
      url.searchParams.get("collection_id") ||
      undefined;

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
    const result = await syncUserPaymentWithMercadoPago({
      userId: targetUserId,
      paymentId: paymentId ? String(paymentId) : undefined,
      email: candidateEmail,
      trusted,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API sync-payment] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

