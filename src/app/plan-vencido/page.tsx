"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Lock,
  ExternalLink,
  LogOut,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  Receipt,
  Layers,
  Calculator,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { createClient } from "@/lib/supabase/client";
import {
  buildPlanExpiredSupportWhatsAppUrl,
  isSupportWhatsAppConfigured,
} from "@/lib/support";
import { getSubscriptionUrl } from "@/lib/plan-helpers";

export default function PlanVencidoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    accountNumber?: string | null;
    businessName?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Cargar perfil para obtener número de cuenta y datos de contacto
        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const data = await res.json();
            const p = data.profile;
            if (p) {
              setProfile({
                accountNumber: p.account_number || user.user_metadata?.account_number || null,
                businessName: p.business_name || user.user_metadata?.business_name || null,
                fullName: p.full_name || user.user_metadata?.full_name || null,
                email: p.email || user.email || null,
              });
            }
          }
        } catch {
          // Fallback a metadata de Auth
          setProfile({
            accountNumber: user.user_metadata?.account_number || null,
            businessName: user.user_metadata?.business_name || null,
            fullName: user.user_metadata?.full_name || null,
            email: user.email || null,
          });
        }
      } catch (err) {
        console.error("Error al cargar datos de usuaria vencida:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [router, supabase]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const subscriptionUrl = getSubscriptionUrl();
  const supportWhatsAppUrl = buildPlanExpiredSupportWhatsAppUrl({
    accountNumber: profile?.accountNumber,
    businessName: profile?.businessName,
    fullName: profile?.fullName,
    email: profile?.email,
  });

  return (
    <div className="min-h-screen bg-[#F6F7F2] flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#EAF0E8] flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Mascota con insignia */}
        <div className="relative">
          <HabaMascot size={110} />
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-2 rounded-2xl shadow-md border-2 border-white">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* Encabezado */}
        <div>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Período de prueba finalizado</span>
          </span>

          <h1 className="text-2xl font-black text-[#2B2B2B] font-display mt-1">
            ¡Tu prueba en HABA terminó!
          </h1>
          <p className="text-xs text-[#7A7A7A] mt-1.5 leading-relaxed">
            Esperamos que HABA te haya ayudado a ordenar tus costos y dar claridad a tu taller.
            Para seguir creando presupuestos y calculando precios, activá tu suscripción mensual.
          </p>
        </div>

        {/* Ficha de datos guardados y protegidos */}
        <div className="w-full bg-[#F6F7F2] rounded-2xl p-4 border border-[#EAF0E8] text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-200/60">
            <span className="font-bold text-[#2B2B2B]">Tus datos están 100% seguros</span>
            {profile?.accountNumber && (
              <span className="font-mono text-[10px] font-bold bg-white text-neutral-800 px-2 py-0.5 rounded-md border border-neutral-200">
                Cuenta #{profile.accountNumber}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
            <div className="bg-white p-2 rounded-xl border border-[#EAF0E8]">
              <Layers className="w-4 h-4 text-[#3BB578] mx-auto mb-1" />
              <span className="text-[10px] font-bold text-[#2B2B2B] block">Tus Insumos</span>
              <span className="text-[9px] text-[#7A7A7A]">Guardados</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#EAF0E8]">
              <Calculator className="w-4 h-4 text-[#3BB578] mx-auto mb-1" />
              <span className="text-[10px] font-bold text-[#2B2B2B] block">Tus Recetas</span>
              <span className="text-[9px] text-[#7A7A7A]">Guardadas</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#EAF0E8]">
              <Receipt className="w-4 h-4 text-[#3BB578] mx-auto mb-1" />
              <span className="text-[10px] font-bold text-[#2B2B2B] block">Presupuestos</span>
              <span className="text-[9px] text-[#7A7A7A]">Guardados</span>
            </div>
          </div>
          <p className="text-[10px] text-neutral-500 text-center">
            Al suscribirte, recuperás el acceso inmediato a todo tu trabajo sin perder nada.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="w-full space-y-2.5 pt-1">
          {/* Botón Principal: Suscribirme por Mercado Pago */}
          {subscriptionUrl ? (
            <a
              href={subscriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-suscribirme-plan-vencido"
              className="w-full py-3.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white font-bold rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Suscribirme al Plan Mensual</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          ) : supportWhatsAppUrl ? (
            <a
              href={supportWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-suscribirme-whatsapp-fallback"
              className="w-full py-3.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white font-bold rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Solicitar suscripción mensual</span>
            </a>
          ) : (
            <div className="p-3 bg-neutral-100 rounded-2xl text-xs text-neutral-600">
              Para suscribirte, contactate con Gio de Amaoto Craft.
            </div>
          )}

          {/* Botón Secundario: WhatsApp Soporte (T2) */}
          {supportWhatsAppUrl && (
            <a
              href={supportWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-soporte-plan-vencido"
              className="w-full py-3 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] font-bold rounded-2xl transition flex items-center justify-center gap-2 text-xs active:scale-[0.99]"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              <span>Contactar a soporte HABA</span>
            </a>
          )}

          {/* Botón Cerrar Sesión */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-2.5 px-4 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-2xl transition flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{signingOut ? "Cerrando sesión..." : "Cerrar sesión"}</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-neutral-400">
        Vos contame qué hacés. Haba hace las cuentas. 🌱
      </div>
    </div>
  );
}
