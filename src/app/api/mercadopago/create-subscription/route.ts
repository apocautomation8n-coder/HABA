import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getTrustedPlanMeta, isPlanExpired } from "@/lib/plan-helpers";
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

    // Validar que el plan esté efectivamente vencido o suspendido (no permitir pago si la prueba está vigente)
    const trustedPlan = getTrustedPlanMeta(user);
    const expired = isPlanExpired(trustedPlan.plan_end_date, trustedPlan.account_status);
    const isSuspended = trustedPlan.account_status === "suspended";

    if (trustedPlan.plan_type === "prueba" && !expired && !isSuspended) {
      return NextResponse.json(
        {
          error:
            "Tu período de prueba aún se encuentra vigente. Podrás activar tu suscripción mensual al momento de su vencimiento.",
        },
        { status: 403 }
      );
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[Mercado Pago] Falta configurar MP_ACCESS_TOKEN en el servidor");
      return NextResponse.json(
        { error: "La pasarela de pago no está configurada en el servidor (falta MP_ACCESS_TOKEN)." },
        { status: 500 }
      );
    }

    // Determinar la URL base de la app
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "haba.app";
    const proto =
      request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, "");
    const backUrl = `${appUrl}/plan-vencido?status=approved`;

    const preapprovalPlanId =
      process.env.MP_PREAPPROVAL_PLAN_ID ||
      process.env.MP_PLAN_ID ||
      "bdef7d4f90264c1ca7be8c8569331414";

    // CRÍTICO: Asegurarse de NO enviar payer_email en este objeto. Omitir este campo por completo.
    const payload = {
      preapproval_plan_id: preapprovalPlanId,
      external_reference: user.id,
      back_url: backUrl,
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("[Mercado Pago] Error en POST /preapproval:", mpData);
      return NextResponse.json(
        {
          error:
            mpData.message ||
            "No se pudo crear la suscripción en Mercado Pago. Por favor intentá nuevamente o contactá a soporte.",
          details: mpData,
        },
        { status: mpRes.status >= 500 ? 502 : 400 }
      );
    }

    const initPoint = mpData.init_point || mpData.sandbox_init_point;
    if (!initPoint) {
      console.error("[Mercado Pago] Respuesta sin init_point:", mpData);
      return NextResponse.json(
        { error: "Mercado Pago no retornó la URL de pago." },
        { status: 502 }
      );
    }

    // Guardar el response.id (subscription_id / preapproval_id) devuelto por Mercado Pago en la tabla profiles
    const admin = getAdminClient();
    try {
      await admin
        .from("profiles")
        .update({
          mp_preapproval_id: mpData.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } catch (dbErr) {
      console.warn("[Mercado Pago] Aviso: profiles.mp_preapproval_id no pudo actualizarse en DB:", dbErr);
    }

    // Mantener también sincronizado en app_metadata y user_metadata de Auth
    try {
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...(user.app_metadata || {}),
          mp_preapproval_id: mpData.id,
        },
        user_metadata: {
          ...(user.user_metadata || {}),
          mp_preapproval_id: mpData.id,
        },
      });
    } catch (authErr) {
      console.warn("[Mercado Pago] Aviso: no se pudo guardar mp_preapproval_id en Auth metadata:", authErr);
    }

    // Retornar { url: response.init_point }
    return NextResponse.json({
      url: initPoint,
      init_point: initPoint,
      id: mpData.id,
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
