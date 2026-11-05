import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { assignOrphanPayment } from "@/lib/mercadopago";

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

async function verifyAdminCaller(request: Request) {
  try {
    let user: any = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const admin = getAdminClient();
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      const supabase = await createServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user || !checkIsAdmin(user)) {
      return { authorized: false, response: NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 }) };
    }

    return { authorized: true, user };
  } catch (err: any) {
    return { authorized: false, response: NextResponse.json({ error: err.message }, { status: 500 }) };
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminCaller(request);
  if (!auth.authorized) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { paymentId, targetUserId } = body;

  if (!paymentId || !targetUserId) {
    return NextResponse.json(
      { error: "paymentId y targetUserId son campos obligatorios" },
      { status: 400 }
    );
  }

  const result = await assignOrphanPayment({
    paymentId: String(paymentId).trim(),
    targetUserId: String(targetUserId).trim(),
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || "No se pudo asignar el pago.",
        alreadyApplied: result.alreadyApplied,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    newEndDate: result.newEndDate,
    paymentId: result.paymentId,
  });
}

