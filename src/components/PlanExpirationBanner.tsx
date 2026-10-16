"use client";

import React, { useEffect, useState } from "react";
import { X, Clock } from "lucide-react";
import { isPlanExpiringSoon, isPlanExpired, formatDateDisplay } from "@/lib/plan-helpers";

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

          // Si el plan ya expiró y por alguna razón no redirigió el middleware, redirigir desde cliente
          if (p && isPlanExpired(p.plan_end_date, p.account_status)) {
            window.location.href = "/plan-vencido";
            return;
          }
        }
      } catch {
        // Silencioso ante errores de red
      } finally {
        setLoaded(true);
      }
    }

    checkPlanStatus();
  }, []);

  if (!loaded || dismissed || !profile) return null;

  // Solo alertar si la cuenta está en período de prueba
  const planType = profile.plan_type || "prueba";
  if (planType !== "prueba") return null;

  const { isExpiringSoon, remainingDays } = isPlanExpiringSoon(profile.plan_end_date, 3);
  if (!isExpiringSoon) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("haba_dismiss_expiring_banner", "true");
    }
  };

  const formattedDate = formatDateDisplay(profile.plan_end_date);
  const dayText =
    remainingDays === 0
      ? "hoy"
      : remainingDays === 1
      ? "en 1 día"
      : `en ${remainingDays} días`;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200/90 text-amber-900 px-3.5 py-2.5 text-xs flex items-center justify-between gap-3 shadow-2xs animate-in slide-in-from-top-1">
      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
        <p className="text-[11px] sm:text-xs leading-relaxed text-amber-900">
          <span className="font-bold">
            Recordatorio: Tu período de prueba finaliza {dayText} (el {formattedDate}).
          </span>{" "}
          <span className="text-amber-800">
            El día del vencimiento podrás activar tu suscripción mensual para no interrumpir tu trabajo.
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition flex-shrink-0"
        title="Descartar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
