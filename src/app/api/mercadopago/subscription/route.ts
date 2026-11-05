import { NextResponse } from "next/server";
import { cancelUserSubscription, getRequestUser, getUserSubscription, saveSubscriptionState } from "@/lib/mp-subscriptions";

export const dynamic = "force-dynamic";

/** Estado de la suscripción de la usuaria, consultado en Mercado Pago. */
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pre = await getUserSubscription(user);
    if (!pre) return NextResponse.json({ subscribed: false });

    // Mantener el estado guardado al día si cambió en Mercado Pago (por ejemplo, baja desde su app)
    if (pre.status && pre.status !== user.app_metadata?.mp_status) {
      await saveSubscriptionState(user.id, { status: pre.status, nextPaymentDate: pre.next_payment_date || null });
    }

    return NextResponse.json({
      subscribed: pre.status === "authorized" || pre.status === "pending",
      status: pre.status,
      nextPaymentDate: pre.next_payment_date || null,
      amount: pre.auto_recurring?.transaction_amount ?? null,
      currency: pre.auto_recurring?.currency_id ?? null,
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
