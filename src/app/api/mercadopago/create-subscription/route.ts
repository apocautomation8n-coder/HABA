import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

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

    // Calcular URL de retorno y notificación webhook
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "haba.app";
    const proto =
      request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const returnPath = body.return_url || url.searchParams.get("return_url") || "/configuracion?status=approved";
    const backUrl = `${baseUrl}${returnPath.startsWith("/") ? returnPath : `/${returnPath}`}`;
    const notificationUrl = `${baseUrl}/api/webhooks/mercadopago`;

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const directSubscriptionUrl = process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_URL;

    // 1. Integración Oficial API Preapproval (con MP_ACCESS_TOKEN)
    // Ata obligatoriamente external_reference = user.id para trazabilidad unívoca
    if (accessToken) {
      const amount = process.env.MP_SUBSCRIPTION_AMOUNT
        ? parseFloat(process.env.MP_SUBSCRIPTION_AMOUNT)
        : 15000;
      const currency = process.env.MP_SUBSCRIPTION_CURRENCY || "ARS";
      const title = process.env.MP_SUBSCRIPTION_TITLE || "Suscripción Mensual HABA";

      const payload: Record<string, any> = {
        reason: title,
        external_reference: user.id,
        payer_email: user.email,
        back_url: backUrl,
        notification_url: notificationUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: currency,
        },
      };

      try {
        const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const mpData = await mpRes.json();

        if (mpRes.ok) {
          const initPoint = mpData.init_point || mpData.sandbox_init_point;
          if (initPoint) {
            return NextResponse.json({
              success: true,
              init_point: initPoint,
              id: mpData.id,
            });
          }
        }

        console.error("[Mercado Pago] Error en respuesta de preapproval:", mpData);

        // Si falló la API pero existe un link de checkout configurado, usar como fallback
        if (!directSubscriptionUrl) {
          return NextResponse.json(
            {
              error:
                mpData.message ||
                "No se pudo crear la suscripción en Mercado Pago. Verificá los credenciales o el importe.",
              details: mpData,
            },
            { status: mpRes.status >= 500 ? 502 : 400 }
          );
        }
      } catch (fetchErr: any) {
        console.error("[Mercado Pago] Error de red llamando a API:", fetchErr);
        if (!directSubscriptionUrl) {
          return NextResponse.json(
            { error: "Error de conexión con Mercado Pago: " + fetchErr.message },
            { status: 502 }
          );
        }
      }
    }

    // 2. Link directo de suscripción (NEXT_PUBLIC_MP_SUBSCRIPTION_URL)
    // Se adjunta external_reference para vincular la cuenta de HABA
    if (directSubscriptionUrl) {
      try {
        const targetUrl = new URL(directSubscriptionUrl);
        targetUrl.searchParams.set("external_reference", user.id);
        return NextResponse.json({
          success: true,
          init_point: targetUrl.toString(),
        });
      } catch {
        return NextResponse.json({
          success: true,
          init_point: directSubscriptionUrl,
        });
      }
    }

    // 3. Si no hay variables de Mercado Pago configuradas
    return NextResponse.json(
      {
        error:
          "La pasarela de pago no está configurada en el servidor (se requiere MP_ACCESS_TOKEN o NEXT_PUBLIC_MP_SUBSCRIPTION_URL).",
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[Mercado Pago] Error inesperado en create-subscription:", err);
    return NextResponse.json(
      { error: "Error inesperado al conectar con Mercado Pago: " + err.message },
      { status: 500 }
    );
  }
}
