import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncUserSubscriptionWithMercadoPago } from "@/lib/mercadopago";
import { checkIsAdmin } from "@/lib/auth-helpers";

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

    const requestedUserId = url.searchParams.get("userId") || body.userId;
    let explicitPayerEmail =
      body.payer_email || body.payerEmail || url.searchParams.get("payer_email") || url.searchParams.get("payerEmail");
    let explicitPreapprovalId =
      body.preapproval_id || body.preapprovalId || url.searchParams.get("preapproval_id") || url.searchParams.get("preapprovalId");
    let explicitPaymentId =
      body.payment_id || body.paymentId || url.searchParams.get("payment_id") || url.searchParams.get("paymentId");
    const rawQuery = body.query || url.searchParams.get("query");

    // Detección inteligente si el usuario ingresó un dato genérico en el prompt (email, n° de operación o ID de suscripción)
    if (explicitPayerEmail) {
      const clean = explicitPayerEmail.trim();
      if (/^\d{6,16}$/.test(clean)) {
        // Es un número de pago/operación (ej: 183522471869)
        explicitPaymentId = clean;
        explicitPayerEmail = undefined;
      } else if (clean.startsWith("2c93") || (clean.length >= 24 && !clean.includes("@"))) {
        // Es un preapproval_id de suscripción
        explicitPreapprovalId = clean;
        explicitPayerEmail = undefined;
      }
    }

    let targetUserId = user.id;
    let targetEmail = user.email;

    // Solo un administrador puede sincronizar a otro usuario
    if (requestedUserId && requestedUserId !== user.id) {
      if (!checkIsAdmin(user)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      targetUserId = requestedUserId;
      targetEmail = url.searchParams.get("email") || body.email || undefined;
    }

    const result = await syncUserSubscriptionWithMercadoPago({
      userId: targetUserId,
      email: targetEmail,
      payerEmail: explicitPayerEmail || undefined,
      preapprovalId: explicitPreapprovalId || undefined,
      paymentId: explicitPaymentId || undefined,
      queryInput: rawQuery || undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API Sync Mercado Pago] Error inesperado:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
