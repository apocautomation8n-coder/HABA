import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { MercadoPagoConfig, Preference } from "mercadopago";

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
      console.error("[Mercado Pago] MP_ACCESS_TOKEN no configurado en variables de entorno.");
      return NextResponse.json(
        { error: "Credenciales de Mercado Pago no configuradas en el servidor." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Determinar la URL base de la app para el retorno post-pago
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "haba.app";
    const proto =
      request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, "");
    const returnPath = body.return_url || "/configuracion?status=approved";
    const redirectUrl = `${appUrl}${returnPath.startsWith("/") ? returnPath : `/${returnPath}`}`;

    const amount = Number(process.env.MP_SUBSCRIPTION_AMOUNT || 7000);
    const currency = process.env.MP_SUBSCRIPTION_CURRENCY || "ARS";
    const title = process.env.MP_SUBSCRIPTION_TITLE || "HABA - Plan Mensual (30 días)";

    // 2. Utilizar el SDK de Mercado Pago para crear la Preferencia (Checkout Pro)
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    // REGLAS ESTRICTAS DE NEGOCIO:
    // - external_reference: user.id (UUID de Supabase del usuario autenticado). PROHIBIDO usar strings estáticos.
    // - OMITIR completamente payer_email y el objeto payer para que cualquier billetera o tarjeta pueda abonar.
    // - Monto total del plan mensual (precio completo de lista, sin prorrateo).
    const preferenceData = {
      body: {
        items: [
          {
            id: "haba-plan-mensual",
            title: title,
            description: "Acceso completo a HABA por 30 días",
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        // UUID UNÍVOCO DE SUPABASE
        external_reference: user.id,
        back_urls: {
          success: redirectUrl,
          pending: redirectUrl,
          failure: redirectUrl,
        },
        auto_return: "approved",
        statement_descriptor: "HABA",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
      },
    };

    const response = await preference.create(preferenceData);

    const initPoint = response.init_point || response.sandbox_init_point;
    if (!initPoint) {
      throw new Error("Mercado Pago SDK no retornó init_point para la preferencia.");
    }

    console.log(
      `[Mercado Pago Preference] Preferencia creada exitosamente #${response.id} para usuario ${user.id} (${amount} ${currency})`
    );

    return NextResponse.json({
      url: initPoint,
      init_point: initPoint,
      preference_id: response.id,
      success: true,
    });
  } catch (err: any) {
    console.error("[Mercado Pago SDK] Error al crear preferencia de Checkout Pro:", err);
    return NextResponse.json(
      { error: "Error al conectar con Mercado Pago: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
