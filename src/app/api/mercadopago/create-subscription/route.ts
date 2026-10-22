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

    const webhookUrl = appUrl.startsWith("https://")
      ? `${appUrl}/api/webhooks/mercadopago`
      : undefined;

    let initPoint: string | null = null;
    let subscriptionPlanId: string | null = null;

    // Intento 1: Creación de un Plan de Suscripción dinámico (/preapproval_plan) con external_reference = user.id
    // REGLA CRÍTICA: NO enviamos payer_email. Esto garantiza que la usuaria pueda pagar con
    // CUALQUIER cuenta de Mercado Pago o tarjeta sin que la pasarela bloquee con "Tu e-mail no coincide".
    try {
      const planPayload: Record<string, any> = {
        reason: "Haba Mensual",
        external_reference: user.id,
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 7000,
          currency_id: "ARS",
        },
        ...(webhookUrl ? { notification_url: webhookUrl } : {}),
      };

      const planRes = await fetch("https://api.mercadopago.com/preapproval_plan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(planPayload),
      });

      if (planRes.ok) {
        const planData = await planRes.json();
        if (planData.init_point) {
          initPoint = planData.init_point;
          subscriptionPlanId = planData.id;
        }
      } else {
        const errData = await planRes.json().catch(() => ({}));
        console.warn("[Mercado Pago] Aviso: POST /preapproval_plan retornó:", errData);
      }
    } catch (planErr) {
      console.warn("[Mercado Pago] Error en POST /preapproval_plan:", planErr);
    }

    // Intento 2 (Fallback estándar confiable): Si el endpoint dinámico no retornó link,
    // usar el checkout directo del plan oficial de Mercado Pago.
    // Este checkout tampoco valida ni bloquea emails de usuario, permitiendo pagar con cualquier cuenta.
    if (!initPoint) {
      initPoint =
        process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_URL ||
        `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${preapprovalPlanId}`;
    }

    // Guardar referencia en Auth metadata si se generó un plan dinámico
    if (subscriptionPlanId) {
      const admin = getAdminClient();
      try {
        await admin.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            mp_preapproval_id: subscriptionPlanId,
          },
          user_metadata: {
            ...(user.user_metadata || {}),
            mp_preapproval_id: subscriptionPlanId,
          },
        });
      } catch (authErr) {
        console.warn("[Mercado Pago] Aviso: auth.mp_preapproval_id no pudo actualizarse:", authErr);
      }
    }

    // Retornar { url: initPoint }
    return NextResponse.json({
      url: initPoint,
      init_point: initPoint,
      id: subscriptionPlanId,
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
