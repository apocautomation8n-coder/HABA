import { NextResponse } from "next/server";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { createUserSubscription, getRequestUser } from "@/lib/mp-subscriptions";

export const dynamic = "force-dynamic";

/**
 * Crea la suscripción mensual de la usuaria (renovación automática) asociada al plan único,
 * con el id de su cuenta. Recibe el token de tarjeta que genera el formulario de Mercado Pago.
 */
export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (checkIsAdmin(user)) {
      return NextResponse.json({ error: "La cuenta de administradora no requiere suscripción." }, { status: 400 });
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "La suscripción no está disponible por el momento." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const cardTokenId = typeof body.card_token_id === "string" ? body.card_token_id.trim() : "";
    const payerEmail = typeof body.payer_email === "string" ? body.payer_email.trim().toLowerCase() : "";

    if (!cardTokenId || cardTokenId.length > 200) {
      return NextResponse.json({ error: "Faltan los datos de la tarjeta." }, { status: 400 });
    }
    if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      return NextResponse.json({ error: "Ingresá un email válido." }, { status: 400 });
    }

    const host = request.headers.get("host") || "";
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, "");

    const result = await createUserSubscription({ user, cardTokenId, payerEmail, appUrl });
    if (!result.success) {
      return NextResponse.json(result, { status: result.alreadySubscribed ? 409 : 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API create-subscription] Error:", err);
    return NextResponse.json({ error: "No se pudo crear la suscripción. Probá de nuevo." }, { status: 500 });
  }
}
