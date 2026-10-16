"use client";

import React, { useEffect, useState } from "react";
import { X, Clock } from "lucide-react";
import { isPlanExpiringSoon, isPlanExpired } from "@/lib/plan-helpers";
import { buildSubscriptionWhatsAppUrl } from "@/lib/support";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export function PlanExpirationBanner() {
  const [profile, setProfile] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Verificar si la usuaria ya lo cerró en esta pestaña/sesión
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("haba_dismiss_expiring_banner") === "true";
      if (isDismissed) setDismissed(true);
    }

    async function checkPlanStatus() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.isAdmin) {
            setLoaded(true);
            return;
          }
          const p = data.profile;
          setProfile(p);

          // Si el plan ya expiró y por alguna razón el middleware no redirigió, redirigir desde cliente
          if (p && isPlanExpired(p.plan_end_date, p.account_status)) {
            window.location.href = "/plan-vencido";
            return;
          }
        }
      } catch (err) {
        // Silencioso ante errores de red
      } finally {
        setLoaded(true);
      }
    }

    checkPlanStatus();
  }, []);

  if (!loaded || dismissed || !profile) return null;

  const { isExpiringSoon, remainingDays } = isPlanExpiringSoon(profile.plan_end_date, 3);
  if (!isExpiringSoon) return null;

  const targetUrl = buildSubscriptionWhatsAppUrl({
    accountNumber: profile.account_number,
    businessName: profile.business_name,
    fullName: profile.full_name,
    email: profile.email,
  });

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("haba_dismiss_expiring_banner", "true");
    }
  };

  const dayText =
    remainingDays === 0
      ? "hoy"
      : remainingDays === 1
      ? "en 1 día"
      : `en ${remainingDays} días`;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200/90 text-amber-900 px-3.5 py-2 text-xs flex items-center justify-between gap-3 shadow-2xs animate-in slide-in-from-top-1">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
        <p className="truncate text-[11px] sm:text-xs">
          <span className="font-bold">Tu período de prueba finaliza {dayText}.</span>{" "}
          <span className="hidden sm:inline text-amber-800">
            Suscribite para seguir usando HABA sin interrupciones.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {targetUrl && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1F7A4C] hover:bg-[#185E3B] text-white font-bold rounded-xl text-[10px] sm:text-[11px] transition shadow-xs active:scale-95"
          >
            <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
            <span>Suscribirme</span>
          </a>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition"
          title="Descartar aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
