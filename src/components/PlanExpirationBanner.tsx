"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { X, Clock, Sparkles, RefreshCw } from "lucide-react";
import { isPlanExpiringSoon, isPlanExpired, formatDateDisplay } from "@/lib/plan-helpers";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { buildSubscriptionWhatsAppUrl } from "@/lib/support";

export function PlanExpirationBanner() {
  const [profile, setProfile] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Si viene parámetro banner=true o test=true en la URL, no considerar el descarte en sessionStorage
    const searchParams =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const forceShow =
      searchParams?.get("banner") === "true" || searchParams?.get("test") === "true";

    if (typeof window !== "undefined" && !forceShow) {
      const isDismissed = sessionStorage.getItem("haba_dismiss_expiring_banner") === "true";
      if (isDismissed) setDismissed(true);
    }

    async function checkPlanStatus() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();

          // REGLA ESTRICTA Y ABSOLUTA:
          // El banner NUNCA debe aparecerle a la cuenta de Administradora (Gio)
          if (data.isAdmin || data.profile?.role === "admin") {
            setLoaded(true);
            return;
          }

          const p = data.profile;
          setProfile(p);

          // Si el plan ya expiró en una usuaria regular, redirigir a /plan-vencido
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

  // Umbral preventivo: hasta 5 días inclusive (alineado con "Próximo a vencer" en toda la app)
  const { isExpiringSoon, remainingDays } = isPlanExpiringSoon(profile.plan_end_date, 5);
  if (!isExpiringSoon) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("haba_dismiss_expiring_banner", "true");
    }
  };

  const isTrial = (profile.plan_type || "prueba") === "prueba";
  const formattedDate = formatDateDisplay(profile.plan_end_date);
  const dayText =
    remainingDays === 0
      ? "hoy"
      : remainingDays === 1
      ? "en 1 día"
      : `en ${remainingDays} días`;

  const bannerText = isTrial
    ? `Recordatorio: Tu período de prueba finaliza ${dayText} (el ${formattedDate}).`
    : `Recordatorio: Tu suscripción finaliza ${dayText} (el ${formattedDate}).`;

  const subWhatsAppUrl = buildSubscriptionWhatsAppUrl({
    accountNumber: profile.account_number,
    businessName: profile.business_name,
    fullName: profile.full_name,
    email: profile.email,
  });

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200/90 text-amber-900 px-3.5 py-2.5 text-xs flex items-center justify-between gap-3 shadow-2xs animate-in slide-in-from-top-1">
      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
        <p className="text-[11px] sm:text-xs leading-relaxed text-amber-900">
          <span className="font-bold">{bannerText}</span>{" "}
          <span className="text-amber-800 hidden sm:inline">
            Comunicate por WhatsApp para renovar tu suscripción sin interrumpir tu trabajo.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {subWhatsAppUrl ? (
          <a
            href={subWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F7A4C] hover:bg-[#185E3B] active:scale-95 text-white font-bold rounded-xl text-[10px] sm:text-[11px] transition shadow-xs"
          >
            <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
            <span>Renovar por WhatsApp</span>
          </a>
        ) : (
          <Link
            href="/configuracion"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F7A4C] hover:bg-[#185E3B] active:scale-95 text-white font-bold rounded-xl text-[10px] sm:text-[11px] transition shadow-xs"
          >
            <span>Ver mi Plan</span>
          </Link>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition cursor-pointer"
          title="Descartar aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
