import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getTrustedPlanMeta, isPlanExpired } from "@/lib/plan-helpers";
import { checkIsAdmin } from "@/lib/auth-helpers";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (checkIsAdmin(user)) {
      return NextResponse.json(
        { error: "La cuenta de administradora no requiere suscripción." },
        { status: 400 }
      );
    }

    // Regla de Negocio Estricta: Prohibido el pago anticipado
    // La usuaria debe gozar de sus 15 días de prueba completos.
    // Solo puede iniciar la suscripción una vez que el plan haya vencido.
    const trustedPlan = getTrustedPlanMeta(user);
    const expired = isPlanExpired(trustedPlan.plan_end_date, trustedPlan.account_status);

    if (!expired) {
      return NextResponse.json(
        {
          error:
            "Tu período de prueba aún se encuentra vigente. Podrás activar tu suscripción mensual el día de su vencimiento.",
        },
        { status: 403 }
      );
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[Mercado Pago] Falta configurar MP_ACCESS_TOKEN en el servidor");
      return NextResponse.json(
        {
          error:
            "La pasarela de pago no está configurada en el servidor (falta MP_ACCESS_TOKEN). Por favor comunicate con soporte.",
        },
        { status: 500 }
      );
    }

    // Parámetros de suscripción mensual
    const amount = process.env.MP_SUBSCRIPTION_AMOUNT
      ? parseFloat(process.env.MP_SUBSCRIPTION_AMOUNT)
      : 15000;
    const currency = process.env.MP_SUBSCRIPTION_CURRENCY || "ARS";
    const title = process.env.MP_SUBSCRIPTION_TITLE || "Suscripción Mensual HABA";

    // Calcular URL de retorno a la app
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "haba.app";
    const proto =
      request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
    const backUrl = `${baseUrl}/plan-vencido?status=approved`;

    // Parámetros obligatorios:
    // - external_reference: user.id (UUID del usuario en Supabase, trazabilidad unívoca)
    // - payer_email: user.email (correo de la cuenta en HABA)
    // - auto_recurring: importe mensual y frecuencia de 1 mes
    // - back_url: retorno a /plan-vencido?status=approved
    const payload = {
      reason: title,
      external_reference: user.id,
      payer_email: user.email,
      back_url: backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: currency,
      },
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
      console.error("[Mercado Pago] Error al crear suscripción (preapproval):", mpData);
      return NextResponse.json(
        {
          error:
            mpData.message ||
            "No se pudo crear la suscripción en Mercado Pago. Por favor contactá a soporte.",
          details: mpData,
        },
        { status: mpRes.status >= 500 ? 502 : 400 }
      );
    }

    const initPoint = mpData.init_point || mpData.sandbox_init_point;
    if (!initPoint) {
      console.error("[Mercado Pago] Respuesta sin init_point:", mpData);
      return NextResponse.json(
        { error: "Mercado Pago no retornó la URL de pago (init_point)." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      init_point: initPoint,
      id: mpData.id,
    });
  } catch (err: any) {
    console.error("[Mercado Pago] Error inesperado en create-subscription:", err);
    return NextResponse.json(
      { error: "Error inesperado al conectar con Mercado Pago: " + err.message },
      { status: 500 }
    );
  }
}
