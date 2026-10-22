import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkIsAdmin } from "@/lib/auth-helpers";

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

export async function POST(request: Request) {
  try {
    let user: any = null;

    // 1. Priorizar Bearer token de Authorization header si fue provisto
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const admin = getAdminClient();
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        user = data.user;
      }
    }

    // 2. Si no vino en Authorization, obtener sesión de cookies del servidor
    if (!user) {
      const supabase = await createServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    // Validar que el usuario esté autenticado con Supabase (user.id)
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // La cuenta de administración no requiere suscripción
    if (checkIsAdmin(user)) {
      return NextResponse.json(
        { error: "La cuenta de administradora no requiere suscripción." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const customPayerEmail = (body.payer_email || "").trim().toLowerCase();

    // Si la usuaria indicó un email de Mercado Pago opcional, guardarlo para trazabilidad y webhook
    if (customPayerEmail) {
      const admin = getAdminClient();
      try {
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...(user.user_metadata || {}),
            mp_payer_email: customPayerEmail,
          },
        });
      } catch (saveErr) {
        console.warn("[Mercado Pago] Aviso al guardar mp_payer_email en user_metadata:", saveErr);
      }
    }

    // Plan Maestro Único oficial configurado para HABA
    const preapprovalPlanId =
      process.env.MP_PREAPPROVAL_PLAN_ID ||
      process.env.MP_PLAN_ID ||
      "bdef7d4f90264c1ca7be8c8569331414";

    // Usar directamente el Checkout oficial del Plan Maestro en Mercado Pago.
    // Esto garantiza que:
    // 1. NO se creen planes duplicados en Mercado Pago. Todas las usuarias se adhieren al MISMO plan maestro ("Haba Mensual").
    // 2. Las usuarias aparezcan ordenadamente bajo la pestaña "Clientes" de ese único plan.
    // 3. La usuaria pueda abonar con CUALQUIER cuenta de Mercado Pago o tarjeta sin bloqueo de email.
    let initPoint =
      process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_URL ||
      `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${preapprovalPlanId}`;

    // Vincular external_reference al user.id para trazabilidad unívoca si el link no lo incluye aún
    if (!initPoint.includes("external_reference=")) {
      const sep = initPoint.includes("?") ? "&" : "?";
      initPoint = `${initPoint}${sep}external_reference=${encodeURIComponent(user.id)}`;
    }

    // Retornar { url: initPoint }
    return NextResponse.json({
      url: initPoint,
      init_point: initPoint,
      id: preapprovalPlanId,
      success: true,
    });
  } catch (err: any) {
    console.error("[Mercado Pago] Error inesperado en create-subscription:", err);
    return NextResponse.json(
      { error: "Error inesperado al conectar con Mercado Pago: " + err.message },
      { status: 500 }
    );
  }
}
