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

    // Nota de negocio: Los usuarios con "Plan Prueba" activo pueden suscribirse y pagar el Plan Mensual
    // anticipadamente en cualquier momento. Al realizar el pago, el ciclo mensual formal comienza de inmediato.

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
    const body = await request.json().catch(() => ({}));
    const returnPath = body.return_url || "/plan-vencido?status=approved";
    const backUrl = `${appUrl}${returnPath.startsWith("/") ? returnPath : `/${returnPath}`}`;

    const preapprovalPlanId =
      process.env.MP_PREAPPROVAL_PLAN_ID ||
      process.env.MP_PLAN_ID ||
      "bdef7d4f90264c1ca7be8c8569331414";

    const payerEmail = (body.payer_email || user.email || "").trim().toLowerCase();

    const payload: Record<string, any> = {
      preapproval_plan_id: preapprovalPlanId,
      external_reference: user.id,
      payer_email: payerEmail,
      back_url: backUrl,
    };

    let mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let mpData = await mpRes.json();

    let initPoint = mpData.init_point || mpData.sandbox_init_point;
    let subscriptionId = mpData.id || null;

    // Salvaguarda: si la API directa de preapproval falla (por ejemplo por conflicto de payer_email o credencial),
    // usar el checkout directo del plan configurado para no bloquear a la usuaria jamás.
    if (!mpRes.ok || !initPoint) {
      console.warn("[Mercado Pago] Aviso: POST /preapproval no retornó init_point, usando URL de plan como fallback:", mpData);
      const fallbackUrl =
        process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_URL ||
        `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${preapprovalPlanId}`;
      initPoint = fallbackUrl;
    }

    // Guardar el response.id (subscription_id / preapproval_id) devuelto por Mercado Pago en profiles si fue generado
    if (subscriptionId) {
      const admin = getAdminClient();
      try {
        await admin
          .from("profiles")
          .update({
            mp_preapproval_id: subscriptionId,
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
            mp_preapproval_id: subscriptionId,
          },
          user_metadata: {
            ...(user.user_metadata || {}),
            mp_preapproval_id: subscriptionId,
          },
        });
      } catch (authErr) {
        console.warn("[Mercado Pago] Aviso: no se pudo guardar mp_preapproval_id en Auth metadata:", authErr);
      }
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
