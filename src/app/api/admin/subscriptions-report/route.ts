import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { buildSubscriptionsReport } from "@/lib/mp-subscriptions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cruce de suscripciones de Mercado Pago con cuentas de HABA (solo administradora). */
export async function GET(request: Request) {
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
    const report = await buildSubscriptionsReport();
    return NextResponse.json({ success: true, ...report }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[API subscriptions-report] Error:", err);
    return NextResponse.json({ error: err.message || "No se pudo armar el informe." }, { status: 500 });
  }
}
