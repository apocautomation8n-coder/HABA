import { NextResponse } from "next/server";
import {
  cancelUserSubscription,
  findAndSaveSubscriptionByReference,
  getRequestUser,
  getUserSubscription,
  syncUserSubscription,
} from "@/lib/mp-subscriptions";

export const dynamic = "force-dynamic";

/**
 * Public Key de Mercado Pago leída en tiempo de ejecución (no al construir la app), para que el
 * formulario de tarjeta funcione apenas se carga la variable en Vercel. Es pública por diseño.
 */
function getPublicKey(): string {
  const names = ["NEXT_PUBLIC_MP_PUBLIC_KEY", "MP_PUBLIC_KEY"];
  for (const name of names) {
    const value = (process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

/** Estado de la suscripción de la usuaria, consultado en Mercado Pago. */
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const publicKey = getPublicKey();
    let pre = await getUserSubscription(user);
    if (!pre || pre.status !== "authorized") {
      // Puede haberse suscripto por el checkout del plan: buscar por el id de la cuenta
      const found = await findAndSaveSubscriptionByReference(user.id, user.email);
      if (found) pre = found;
    }
    if (!pre) return NextResponse.json({ subscribed: false, publicKey });

    // Si cambió el estado en Mercado Pago (se activó, o baja desde su app), sincronizar la cuenta:
    // guarda el estado y, si está activa, deja el vencimiento en el próximo cobro + gracia.
    // Así el plan se actualiza al abrir Ajustes aunque la usuaria no haya vuelto desde Mercado Pago.
    if (pre.status && pre.status !== user.app_metadata?.mp_status) {
      await syncUserSubscription(user.id);
    }

    return NextResponse.json({
      // Solo una suscripción autorizada cuenta como activa. Una pendiente (empezó a pagar y no
      // terminó) no bloquea: se devuelve su link para que pueda completar el pago.
      subscribed: pre.status === "authorized",
      status: pre.status,
      pendingInitPoint: pre.status === "pending" && pre.init_point ? pre.init_point : null,
      nextPaymentDate: pre.status === "authorized" ? pre.next_payment_date || null : null,
      amount: pre.auto_recurring?.transaction_amount ?? null,
      currency: pre.auto_recurring?.currency_id ?? null,
      publicKey,
    });
  } catch (err: any) {
    console.error("[API subscription] Error:", err);
    return NextResponse.json({ error: "No se pudo consultar la suscripción." }, { status: 500 });
  }
}

/** Cancela la renovación automática. El acceso sigue hasta el último día pagado. */
export async function DELETE(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const result = await cancelUserSubscription(user);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error("[API subscription DELETE] Error:", err);
    return NextResponse.json({ error: "No se pudo cancelar la suscripción." }, { status: 500 });
  }
}
