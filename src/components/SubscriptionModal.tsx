"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  CreditCard,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  Lock,
  RefreshCw,
  CalendarClock,
  Wallet,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";

/**
 * Suscripción mensual con renovación automática.
 * Los datos de la tarjeta se cargan en el formulario seguro de Mercado Pago (cardForm, en iframes):
 * HABA solo recibe un token de un solo uso y con él crea la suscripción asociada al plan único,
 * con el id de la cuenta. Si ya está suscripta, muestra el estado y la opción de cancelar.
 */

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  returnUrl?: string;
  planTitle?: string;
  planAmount?: string;
}

type SubscriptionInfo = {
  subscribed: boolean;
  status?: string;
  nextPaymentDate?: string | null;
  publicKey?: string;
  /** Link de Mercado Pago de una suscripción empezada y no terminada. */
  pendingInitPoint?: string | null;
};

const MP_SDK_URL = "https://sdk.mercadopago.com/js/v2";
// Clave incluida al construir la app; si falta, se usa la que devuelve el servidor en el momento
const BUILD_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "";
const PLAN_AMOUNT = process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_AMOUNT || "7000";

let sdkPromise: Promise<void> | null = null;
function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Sin navegador"));
  if ((window as any).MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MP_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("No se pudo cargar Mercado Pago"));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Estilo de los campos de Mercado Pago (iframes): mismo tamaño de letra que el resto del formulario
const IFRAME_STYLE = { fontSize: "14px", color: "#2B2B2B" };

const fieldBox =
  "h-10 px-3 bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl flex items-center focus-within:bg-white focus-within:border-[#3BB578] transition";
const inputClass =
  "w-full h-10 px-3 text-sm bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B] transition";
const labelClass = "text-[11px] font-semibold text-[#2B2B2B] block mb-1";

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = "",
  planTitle = "Plan Mensual HABA",
  planAmount = "$7.000",
}) => {
  const supabase = createClient();
  useModalThemeColor(isOpen);

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"subscribed" | "cancelled" | null>(null);
  // Cómo quiere pagar: en Mercado Pago (saldo o sus tarjetas) o con tarjeta en el formulario
  const [method, setMethod] = useState<"mercadopago" | "card" | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const cardFormRef = useRef<any>(null);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, [supabase]);

  // Al abrir: consultar si ya tiene una suscripción activa
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDone(null);
    setMethod(null);
    setRedirecting(false);
    setConfirmCancel(false);
    setFormReady(false);
    setInfo(null);
    let cancelled = false;
    (async () => {
      try {
        setLoadingInfo(true);
        const res = await fetch("/api/mercadopago/subscription", { headers: await authHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setInfo(res.ok ? data : { subscribed: false });
      } catch {
        if (!cancelled) setInfo({ subscribed: false });
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, authHeaders]);

  const createSubscription = useCallback(
    async (token: string, email: string) => {
      try {
        setSubmitting(true);
        setError(null);
        const res = await fetch("/api/mercadopago/create-subscription", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ card_token_id: token, payer_email: email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          if (data.alreadySubscribed) {
            setInfo({ subscribed: true, status: data.status, nextPaymentDate: data.nextPaymentDate });
            return;
          }
          throw new Error(data.error || "No se pudo crear la suscripción.");
        }
        setInfo({ subscribed: true, status: data.status, nextPaymentDate: data.nextPaymentDate });
        setDone("subscribed");
      } catch (err: any) {
        setError(err?.message || "No se pudo crear la suscripción.");
      } finally {
        setSubmitting(false);
      }
    },
    [authHeaders]
  );

  // Montar el formulario seguro de Mercado Pago cuando corresponde mostrarlo
  const canSubscribe = isOpen && info !== null && !info.subscribed && !done;
  const showForm = canSubscribe && method === "card";

  // Pagar en Mercado Pago: HABA crea la suscripción con el id de la cuenta y manda al link personal
  const handleMercadoPago = async () => {
    try {
      setRedirecting(true);
      setError(null);
      const res = await fetch("/api/mercadopago/create-subscription", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ mode: "mercadopago", payer_email: defaultEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.initPoint) {
        if (data.alreadySubscribed) {
          setInfo({ subscribed: true, status: data.status, nextPaymentDate: data.nextPaymentDate });
          return;
        }
        throw new Error(data.error || "No se pudo iniciar la suscripción en Mercado Pago.");
      }
      window.location.href = data.initPoint;
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar la suscripción en Mercado Pago.");
      setRedirecting(false);
    }
  };
  useEffect(() => {
    if (!showForm) return;
    const publicKey = BUILD_PUBLIC_KEY || info?.publicKey || "";
    if (!publicKey) {
      setError("El pago con tarjeta no está disponible por el momento.");
      return;
    }
    let disposed = false;
    loadMercadoPagoSdk()
      .then(() => {
        if (disposed) return;
        const mp = new (window as any).MercadoPago(publicKey, { locale: "es-AR" });
        const cardForm = mp.cardForm({
          amount: String(PLAN_AMOUNT),
          iframe: true,
          form: {
            id: "haba-subscription-form",
            cardNumber: { id: "haba-sub-cardNumber", placeholder: "Número de tarjeta", style: IFRAME_STYLE },
            expirationDate: { id: "haba-sub-expirationDate", placeholder: "MM/AA", style: IFRAME_STYLE },
            securityCode: { id: "haba-sub-securityCode", placeholder: "Código", style: IFRAME_STYLE },
            cardholderName: { id: "haba-sub-cardholderName", placeholder: "Como figura en la tarjeta" },
            issuer: { id: "haba-sub-issuer", placeholder: "Banco emisor" },
            installments: { id: "haba-sub-installments", placeholder: "Cuotas" },
            identificationType: { id: "haba-sub-identificationType", placeholder: "Tipo" },
            identificationNumber: { id: "haba-sub-identificationNumber", placeholder: "Número de documento" },
            cardholderEmail: { id: "haba-sub-cardholderEmail", placeholder: "Email" },
          },
          callbacks: {
            onFormMounted: (err: any) => {
              if (disposed) return;
              if (err) {
                console.warn("[SubscriptionModal] Error al montar el formulario:", err);
                setError("No se pudo cargar el formulario de tarjeta. Probá de nuevo.");
                return;
              }
              setFormReady(true);
            },
            onSubmit: (event: Event) => {
              event.preventDefault();
              const data = cardForm.getCardFormData();
              if (!data?.token) {
                setError("Revisá los datos de la tarjeta.");
                return;
              }
              createSubscription(data.token, String(data.cardholderEmail || defaultEmail).trim());
            },
          },
        });
        cardFormRef.current = cardForm;
      })
      .catch(() => {
        if (!disposed) setError("No se pudo conectar con Mercado Pago. Revisá tu conexión.");
      });
    return () => {
      disposed = true;
      try {
        cardFormRef.current?.unmount?.();
      } catch {
        // ignore
      }
      cardFormRef.current = null;
    };
  }, [showForm, createSubscription, defaultEmail, info?.publicKey]);

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);
      const res = await fetch("/api/mercadopago/subscription", { method: "DELETE", headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo cancelar la suscripción.");
      setInfo({ subscribed: false, status: "cancelled" });
      setDone("cancelled");
    } catch (err: any) {
      setError(err?.message || "No se pudo cancelar la suscripción.");
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  const handleClose = () => {
    if (submitting || cancelling) return;
    if (done) {
      // Refrescar para que la app muestre el estado nuevo del plan
      window.location.reload();
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  // Se dibuja en el body y por encima de la barra de navegación inferior (z-50)
  const modal = (
    <div
      className="fixed inset-0 z-[99998] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      style={{ height: "100dvh" }}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        style={{ maxHeight: "min(92dvh, calc(100dvh - 1rem))" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-subscription-title"
      >
        {/* Cabecera */}
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-subscription-title" className="text-sm font-bold text-neutral-800">
                {info?.subscribed ? "Tu suscripción" : "Suscribirme al Plan Mensual"}
              </h2>
              <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Pago seguro con Mercado Pago
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting || cancelling}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition disabled:opacity-40 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="overflow-y-auto overscroll-contain flex-1 min-h-0"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
        >
          {error && (
            <div
              role="alert"
              className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resumen del plan */}
          <div className="mx-5 mt-4 p-4 bg-gradient-to-br from-[#F6FBF7] to-[#EDF8F0] border border-[#CDEBD3] rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1F7A4C]" />
                <span className="text-xs font-bold text-neutral-800">{planTitle}</span>
              </div>
              <span className="text-xs font-extrabold text-[#1F7A4C] bg-white px-2.5 py-0.5 rounded-lg border border-[#C3EBC0]">
                {planAmount} / mes
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed flex items-start gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#1F7A4C]" />
              <span>
                Se renueva sola cada mes con la tarjeta que cargues. Podés cancelarla cuando quieras y seguís usando
                HABA hasta el último día pagado.
              </span>
            </p>
          </div>

          {loadingInfo && (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Consultando tu suscripción...</span>
            </div>
          )}

          {/* Resultado de la operación */}
          {done && (
            <div className="p-5 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-[#3BB578] mx-auto" />
              <h3 className="text-sm font-bold text-neutral-800">
                {done === "subscribed" ? "¡Listo! Tu suscripción quedó activa" : "Cancelaste tu suscripción"}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {done === "subscribed"
                  ? "El primer cobro se acredita en tu cuenta en unos minutos. Después se renueva sola cada mes."
                  : "No se te va a volver a cobrar. Podés seguir usando HABA hasta el último día que pagaste."}
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-xl transition"
              >
                Entendido
              </button>
            </div>
          )}

          {/* Ya suscripta: estado y cancelar */}
          {!done && info?.subscribed && (
            <div className="p-5 space-y-3">
              <div className="p-3 bg-white border border-[#EAF0E8] rounded-2xl flex items-center gap-2.5 text-xs">
                <CalendarClock className="w-4 h-4 text-[#1F7A4C] shrink-0" />
                <div>
                  <span className="font-bold text-neutral-800 block">Suscripción activa</span>
                  {info.nextPaymentDate && (
                    <span className="text-neutral-500">Próximo cobro: {formatDate(info.nextPaymentDate)}</span>
                  )}
                </div>
              </div>
              {!confirmCancel ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="w-full py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition"
                >
                  Cancelar suscripción
                </button>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5">
                  <p className="text-xs text-rose-800 leading-relaxed">
                    ¿Seguro? No se te va a volver a cobrar y vas a poder usar HABA hasta el último día pagado.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                      className="flex-1 py-2 bg-white border border-neutral-200 text-neutral-600 text-xs font-bold rounded-xl"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-70"
                    >
                      {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Sí, cancelar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Elegir cómo pagar */}
          {canSubscribe && method === null && (
            <div className="p-5 space-y-2.5">
              {info?.pendingInitPoint && (
                <a
                  href={info.pendingInitPoint}
                  className="w-full p-3.5 bg-[#DCF4D7] border border-[#C3EBC0] hover:bg-[#cbf0c4] rounded-2xl text-left flex items-center gap-3 transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-white text-[#1F7A4C] flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-[#1F7A4C] block">Terminar el pago en Mercado Pago</span>
                    <span className="text-[11px] text-[#1F7A4C]/80 block leading-snug">
                      Empezaste una suscripción y quedó sin confirmar. Retomala desde acá.
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#1F7A4C] shrink-0" />
                </a>
              )}
              <p className="text-[11px] font-semibold text-neutral-700">
                {info?.pendingInitPoint ? "O empezá de nuevo:" : "¿Cómo querés pagar?"}
              </p>
              <button
                type="button"
                onClick={handleMercadoPago}
                disabled={redirecting}
                className="w-full p-3.5 bg-white border border-[#C3EBC0] hover:border-[#3BB578] hover:bg-[#F6FBF7] rounded-2xl text-left flex items-center gap-3 transition disabled:opacity-70"
              >
                <div className="w-9 h-9 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center shrink-0">
                  {redirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-neutral-800 block">Con mi cuenta de Mercado Pago</span>
                  <span className="text-[11px] text-neutral-500 block leading-snug">
                    Saldo, tarjeta de Mercado Pago o la tarjeta que tengas guardada. Te lleva a Mercado Pago.
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setMethod("card")}
                disabled={redirecting}
                className="w-full p-3.5 bg-white border border-neutral-200 hover:border-[#3BB578] hover:bg-[#F6FBF7] rounded-2xl text-left flex items-center gap-3 transition disabled:opacity-70"
              >
                <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-neutral-800 block">Con tarjeta de crédito o débito</span>
                  <span className="text-[11px] text-neutral-500 block leading-snug">
                    Cargás la tarjeta acá, en el formulario seguro de Mercado Pago. No sirve la tarjeta de Mercado Pago.
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
              </button>
              <p className="text-[10px] text-neutral-400 text-center leading-snug pt-1">
                En los dos casos la suscripción se renueva sola y podés cancelarla cuando quieras.
              </p>
            </div>
          )}

          {/* Formulario seguro de tarjeta (Mercado Pago) */}
          {showForm && (
            <form id="haba-subscription-form" className="p-5 space-y-3" noValidate>
              {!formReady && !error && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando el formulario seguro de Mercado Pago...</span>
                </div>
              )}
              <div className={formReady ? "space-y-3" : "space-y-3 opacity-0 h-0 overflow-hidden"}>
                <div>
                  <span className={labelClass}>Número de tarjeta</span>
                  <div id="haba-sub-cardNumber" className={fieldBox} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={labelClass}>Vencimiento</span>
                    <div id="haba-sub-expirationDate" className={fieldBox} />
                  </div>
                  <div>
                    <span className={labelClass}>Código de seguridad</span>
                    <div id="haba-sub-securityCode" className={fieldBox} />
                  </div>
                </div>
                <div>
                  <label htmlFor="haba-sub-cardholderName" className={labelClass}>
                    Titular de la tarjeta
                  </label>
                  <input id="haba-sub-cardholderName" type="text" autoComplete="cc-name" className={inputClass} />
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <div>
                    <label htmlFor="haba-sub-identificationType" className={labelClass}>
                      Documento
                    </label>
                    <select id="haba-sub-identificationType" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="haba-sub-identificationNumber" className={labelClass}>
                      Número
                    </label>
                    <input id="haba-sub-identificationNumber" type="text" inputMode="numeric" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="haba-sub-cardholderEmail" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="haba-sub-cardholderEmail"
                    type="email"
                    autoComplete="email"
                    defaultValue={defaultEmail}
                    className={inputClass}
                  />
                </div>
                {/* El formulario de Mercado Pago los necesita; para la suscripción no se usan cuotas */}
                <select id="haba-sub-issuer" className="hidden" aria-hidden="true" tabIndex={-1} />
                <select id="haba-sub-installments" className="hidden" aria-hidden="true" tabIndex={-1} />

                <div className="pt-1 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMethod(null);
                    }}
                    disabled={submitting}
                    className="w-1/3 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formReady}
                    className="w-2/3 py-2.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-75"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Creando suscripción...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Suscribirme por {planAmount} / mes</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 text-center leading-snug">
                  Los datos de tu tarjeta se cargan directamente en Mercado Pago. HABA no los ve ni los guarda.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
};
