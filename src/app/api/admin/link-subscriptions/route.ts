import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { linkAllSubscriptions } from "@/lib/mp-subscriptions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pasada única (administradora): vincula a cada cuenta con pagos acreditados su suscripción de
 * Mercado Pago, para que los cobros mensuales se acrediten solos.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const isServiceRole =
      Boolean(authHeader) &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    if (!isServiceRole) {
      const supabase = await createServerClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      if (!checkIsAdmin(data.user)) {
        return NextResponse.json({ error: "Acceso denegado: solo administradora (Gio)" }, { status: 403 });
      }
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 503 });
    }
    const result = await linkAllSubscriptions();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[API link-subscriptions] Error:", err);
    return NextResponse.json({ error: err.message || "No se pudieron vincular las suscripciones." }, { status: 500 });
  }
}
