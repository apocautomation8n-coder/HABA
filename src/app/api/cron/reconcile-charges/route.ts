import { NextResponse } from "next/server";
import { reconcileSubscriptionCharges } from "@/lib/mp-subscriptions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tarea programada (Vercel Cron, ver vercel.json): acredita los cobros aprobados en Mercado Pago
 * que no se acreditaron por el webhook. Protegida con CRON_SECRET (Vercel lo manda solo).
 */
export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.MP_ACCESS_TOKEN) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 503 });
  }
  try {
    const result = await reconcileSubscriptionCharges({ sinceDays: 20 });
    console.log(
      `[Cron conciliación MP] revisados ${result.pagosRevisados}, acreditados ${result.acreditados.length}, sin cuenta ${result.sinCuenta.length}`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[Cron conciliación MP] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
