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
    const preapprovalId = body.preapproval_id || url.searchParams.get("preapproval_id") || undefined;
    const paymentId =
      body.payment_id ||
      url.searchParams.get("payment_id") ||
      body.collection_id ||
      url.searchParams.get("collection_id") ||
      undefined;

    let targetUserId = user?.id || requestedUserId;
    let targetEmail = body.email || url.searchParams.get("email") || user?.email;

    // Solo un administrador o service_role puede sincronizar a otro usuario
    if (requestedUserId && requestedUserId !== user?.id) {
      if (!isServiceRole && !checkIsAdmin(user)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      targetUserId = requestedUserId;
      targetEmail = url.searchParams.get("email") || body.email || undefined;
    }

    const result = await syncUserSubscriptionWithMercadoPago({
      userId: targetUserId,
      email: targetEmail,
      preapprovalId,
      paymentId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API Sync Mercado Pago] Error inesperado:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
