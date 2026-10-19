"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Mail, AlertCircle, Loader2, ExternalLink, ShieldCheck, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  returnUrl?: string;
  planTitle?: string;
  planAmount?: string;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = "",
  returnUrl = "/configuracion?status=approved",
  planTitle = "Plan Mensual HABA",
  planAmount = "$7.000",
}) => {
  const supabase = createClient();
  useModalThemeColor(isOpen);

  const [mpEmail, setMpEmail] = useState<string>(defaultEmail);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMpEmail(defaultEmail);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, defaultEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = mpEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Por favor ingresá un correo electrónico válido de Mercado Pago.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/mercadopago/create-subscription", {
        method: "POST",
        headers,
        body: JSON.stringify({
          payer_email: cleanEmail,
          return_url: returnUrl,
        }),
      });

      const data = await res.json();
      const redirectUrl = data.url || data.init_point;

      if (!res.ok || !redirectUrl) {
        throw new Error(data.error || "No se pudo generar la sesión de pago en Mercado Pago.");
      }

      // Redirigir a la pasarela oficial de Mercado Pago
      window.location.href = redirectUrl;
    } catch (err: any) {
      console.error("[SubscriptionModal] Error al crear suscripción:", err);
      setError(err.message || "Error al conectar con la pasarela de Mercado Pago.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-subscription-title"
      >
        {/* Cabecera */}
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-subscription-title" className="text-sm font-bold text-neutral-800">
                Suscribirme al Plan Mensual
              </h2>
              <p className="text-[11px] text-neutral-500">Pasarela oficial de Mercado Pago</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition disabled:opacity-40 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tarjeta de Resumen del Plan */}
          <div className="p-3.5 bg-gradient-to-br from-[#F6FBF7] to-[#EDF8F0] border border-[#CDEBD3] rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1F7A4C]" />
                <span className="text-xs font-bold text-neutral-800">{planTitle}</span>
              </div>
              <span className="text-xs font-extrabold text-[#1F7A4C] bg-white px-2 py-0.5 rounded-lg border border-[#C3EBC0]">
                {planAmount} / mes
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Cobro mensual automático cada 30 días. Podés cancelar o pausar tu suscripción en cualquier momento.
            </p>
          </div>

          {/* Campo: Email de Mercado Pago */}
          <div className="space-y-1.5">
            <label htmlFor="mp-payer-email" className="text-xs font-bold text-neutral-700 flex items-center justify-between">
              <span>Email de tu cuenta en Mercado Pago</span>
              <span className="text-[10px] font-normal text-neutral-400">Requerido por MP</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="mp-payer-email"
                type="email"
                value={mpEmail}
                onChange={(e) => setMpEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                required
                disabled={loading}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition disabled:opacity-60"
              />
            </div>

            {/* Tip explicativo */}
            <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-snug flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>¿Pagás varias cuentas de HABA desde el mismo Mercado Pago?</strong> Ingresá acá el email con el que iniciás sesión en Mercado Pago. La suscripción se asociará automáticamente a este usuario de HABA sin importar de qué correo sea tu MP.
              </span>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/3 py-2.5 px-3 border border-neutral-200 hover:bg-neutral-50 active:scale-[0.99] text-neutral-600 text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Conectando con MP...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ir a Pagar en Mercado Pago</span>
                  <ExternalLink className="w-3 h-3 text-white/80" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
