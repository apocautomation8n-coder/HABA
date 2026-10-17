"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  LogOut,
  ShieldAlert,
  Receipt,
  Layers,
  Calculator,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { createClient } from "@/lib/supabase/client";
import { buildPlanExpiredSupportWhatsAppUrl } from "@/lib/support";
import { isPlanExpired } from "@/lib/plan-helpers";

function PlanVencidoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    accountNumber?: string | null;
    businessName?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const statusParam = searchParams.get("status");
  const isApprovedReturn = statusParam === "approved" || statusParam === "success";

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

        // A la cuenta de Admin NUNCA le expira el plan ni puede permanecer en /plan-vencido
        const { checkIsAdmin } = await import("@/lib/auth-helpers");
        if (checkIsAdmin(user)) {
          router.push("/dashboard");
          return;
        }

        // Si volvió de Mercado Pago con status=approved, verificar si el webhook ya activó la cuenta
        if (isApprovedReturn) {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const data = await res.json();
            const p = data.profile;
            if (p && !isPlanExpired(p.plan_end_date, p.account_status)) {
              window.location.href = "/dashboard";
              return;
            }
          }
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
  }, [router, supabase, isApprovedReturn]);

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      setErrorMessage(null);

      const res = await fetch("/api/mercadopago/create-subscription", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.init_point) {
        throw new Error(data.error || "No se pudo iniciar el proceso de suscripción.");
      }

      // Redirigir al checkout oficial de Mercado Pago
      window.location.href = data.init_point;
    } catch (err: any) {
      console.error("Error al suscribirse:", err);
      setErrorMessage(
        err.message || "Ocurrió un error al contactar a Mercado Pago. Por favor intentá nuevamente."
      );
      setSubscribing(false);
    }
  };

  const handleVerifyStatus = async () => {
    try {
      setVerifyingPayment(true);
      try {
        await fetch("/api/mercadopago/sync", { method: "POST" });
      } catch {}
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        const p = data.profile;
        if (p && !isPlanExpired(p.plan_end_date, p.account_status)) {
          window.location.href = "/dashboard";
          return;
        }
      }
      setErrorMessage(
        "Tu pago aún está siendo procesado por Mercado Pago. Esto puede demorar unos instantes. Podés aguardar o consultar a soporte."
      );
    } catch {
      setErrorMessage("No se pudo verificar el estado en este momento.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

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
            Esperamos que HABA te haya ayudado a ordenar tus costos y dar claridad a tu emprendimiento.
            Para seguir creando presupuestos y calculando precios, activá tu suscripción mensual.
          </p>
        </div>

        {/* Banner de retorno de pago exitoso si aplica */}
        {isApprovedReturn && (
          <div className="w-full bg-[#EBF8F0] border border-[#BCE7CA] p-3.5 rounded-2xl text-left space-y-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1F7A4C] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#1F7A4C]">
                <p className="font-bold">¡Pago registrado en Mercado Pago!</p>
                <p className="text-[11px] text-[#2E7D32] mt-0.5">
                  Estamos sincronizando tu cuenta. Si aún no accediste, hacé clic en verificar.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleVerifyStatus}
              disabled={verifyingPayment}
              className="w-full py-2 bg-[#1F7A4C] hover:bg-[#185E3B] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingPayment ? "animate-spin" : ""}`} />
              <span>{verifyingPayment ? "Verificando..." : "Verificar y entrar a HABA"}</span>
            </button>
          </div>
        )}

        {/* Mensaje de error si ocurrió algún problema */}
        {errorMessage && (
          <div className="w-full bg-rose-50 border border-rose-200 p-3 rounded-2xl text-left flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

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
              <span className="text-[10px] font-bold text-[#2B2B2B] block">Tus Productos</span>
              <span className="text-[9px] text-[#7A7A7A]">Guardados</span>
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
        <div className="w-full space-y-3 pt-1">
          {/* Aviso de suscripciones pausadas temporalmente */}
          <div className="w-full bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 text-left space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Suscripciones online en mantenimiento</span>
            </div>
            <p className="text-[11.5px] text-amber-800 leading-relaxed">
              El cobro automático por Mercado Pago se encuentra temporalmente pausado por mantenimiento. Para activar tu cuenta y recuperar acceso inmediato a tus presupuestos, contactanos por WhatsApp.
            </p>
          </div>

          {/* Botón Principal: WhatsApp Soporte (Gio) */}
          {supportWhatsAppUrl && (
            <a
              href={supportWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-soporte-plan-vencido"
              className="w-full py-3.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 text-xs shadow-sm active:scale-[0.99]"
            >
              <WhatsAppIcon className="w-4 h-4 text-white" />
              <span>Activar mi cuenta por WhatsApp</span>
            </a>
          )}

          {/* Botón Verificar Estado si ya pagó */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleVerifyStatus}
              disabled={verifyingPayment}
              className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition flex items-center justify-center gap-2 text-[11px] disabled:opacity-75 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingPayment ? "animate-spin" : ""}`} />
              <span>{verifyingPayment ? "Consultando estado..." : "¿Ya habías abonado previamente? Verificar estado"}</span>
            </button>
          </div>

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

export default function PlanVencidoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F7F2] flex items-center justify-center text-neutral-400 text-xs">
          Cargando...
        </div>
      }
    >
      <PlanVencidoContent />
    </Suspense>
  );
}
