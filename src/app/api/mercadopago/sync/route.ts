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
    const body = await request.json().catch(() => ({}));
    const requestedUserId = url.searchParams.get("userId") || body.userId;
    const preapprovalId = body.preapproval_id || url.searchParams.get("preapproval_id") || undefined;

    let targetUserId = user.id;
    let targetEmail = body.email || url.searchParams.get("email") || user.email;

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
      preapprovalId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API Sync Mercado Pago] Error inesperado:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
