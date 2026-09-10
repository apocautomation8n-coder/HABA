"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Store, Mail, ShieldCheck, LogOut, Check, Sparkles, Smartphone, Bell, Clock, RefreshCw } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [role, setRole] = useState<string>("user");
  const [priceReviewDays, setPriceReviewDays] = useState<number>(15);
  const [savedNotifSuccess, setSavedNotifSuccess] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
          setEmail(user.email || "");

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, business_name, role")
            .eq("id", user.id)
            .single();

          if (profile) {
            setFullName(profile.full_name || "");
            setBusinessName(profile.business_name || "");
            setRole(profile.role || "user");
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();

    // Cargar preferencias de notificaciones desde localStorage
    const savedDays = localStorage.getItem("haba_price_review_days");
    if (savedDays) setPriceReviewDays(parseInt(savedDays, 10) || 15);
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          business_name: businessName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (!error) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HabaMascot size={70} className="animate-bounce" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-5">
      {/* Header Perfil */}
      <div className="flex items-center gap-3.5 bg-white p-4 rounded-3xl border border-[#EAF0E8] shadow-sm">
        <HabaMascot size={60} />
        <div>
          <h2 className="text-base font-bold text-neutral-800">
            {fullName || "Mi Perfil"}
          </h2>
          <p className="text-xs text-neutral-500">{email}</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full font-semibold mt-1">
            <ShieldCheck className="w-3 h-3" />
            {role === "admin" ? "SuperAdmin Gio" : "Cuenta Emprendedora"}
          </span>
        </div>
      </div>

      {/* Formulario de Emprendimiento */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3.5">
          Datos de tu Negocio
        </h3>
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#3BB578]" />
              Nombre del Emprendimiento
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Amaoto Craft, Mis Creaciones..."
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
            />
            <p className="text-[10px] text-neutral-400">
              Este nombre aparecerá en el encabezado de tus presupuestos.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#3BB578]" />
              Tu Nombre Completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Giulianna Penna"
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
            />
          </div>

          <div className="space-y-1 opacity-70">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-neutral-400" />
              Email de acceso
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-100 border border-neutral-200 rounded-2xl text-neutral-500 cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white font-semibold rounded-2xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-sm"
          >
            {saving ? (
              <span>Guardando...</span>
            ) : savedSuccess ? (
              <span className="flex items-center gap-1 text-white">
                <Check className="w-4 h-4" /> ¡Guardado con éxito!
              </span>
            ) : (
              <span>Guardar cambios</span>
            )}
          </button>
        </form>
      </div>

      {/* Preferencias de Notificaciones */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3.5">
          Preferencias de Notificaciones
        </h3>

        <div className="space-y-4">
          {/* Recordatorio de precios */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-800">Recordatorio de precios</p>
                <p className="text-[10px] text-neutral-400">
                  Te aviso si un insumo no se actualiza hace más de...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={priceReviewDays}
                onChange={(e) => setPriceReviewDays(parseInt(e.target.value, 10))}
                className="flex-1 accent-[#3BB578] h-1.5"
              />
              <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 min-w-[70px] justify-center">
                <span className="text-sm font-bold text-[#1F7A4C]">{priceReviewDays}</span>
                <span className="text-[10px] text-neutral-500">días</span>
              </div>
            </div>

            <p className="text-[10px] text-neutral-400 leading-snug">
              💡 Si hace más de <strong className="text-neutral-600">{priceReviewDays} días</strong> que no actualizás el precio de un insumo, te lo vamos a marcar en las notificaciones para que revises.
            </p>
          </div>

          {/* Botón guardar preferencias */}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("haba_price_review_days", priceReviewDays.toString());
              setSavedNotifSuccess(true);
              setTimeout(() => setSavedNotifSuccess(false), 3000);
            }}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-2xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            {savedNotifSuccess ? (
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4" /> ¡Preferencias guardadas!
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Bell className="w-3.5 h-3.5" /> Guardar preferencias de alerta
              </span>
            )}
          </button>
        </div>
      </div>
      {/* Enlace al panel de administración si es Admin */}
      {role === "admin" && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-emerald-900">Panel Gio (SuperAdmin)</p>
              <p className="text-[11px] text-emerald-700">Gestionar altas y bajas de usuarias</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition"
          >
            Abrir
          </button>
        </div>
      )}

      {/* Instalar App en el Celular */}
      <div className="bg-white border border-[#EAF0E8] p-4 rounded-3xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#DCF4D7] text-[#3BB578] flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-800">Instalar en la pantalla de inicio</p>
            <p className="text-[11px] text-neutral-500">Usá HABA como app en tu celular</p>
          </div>
        </div>
        <button
          onClick={() => {
            const isRunningStandalone =
              window.matchMedia("(display-mode: standalone)").matches ||
              (window.navigator as any).standalone === true;
            if (isRunningStandalone) {
              alert("¡Ya tenés HABA instalada como aplicación!");
            } else {
              alert("Para instalar en iPhone: Toca el botón Compartir en Safari y luego 'Agregar a pantalla de inicio'. En Android: Toca el menú de 3 puntos y 'Instalar aplicación'.");
            }
          }}
          className="px-3 py-1.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white font-semibold rounded-xl text-xs transition"
        >
          Instalar
        </button>
      </div>

      {/* Actualizar Sistema */}
      <div className="bg-white border border-blue-200 p-4 rounded-3xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <RefreshCw className={`w-5 h-5 ${updating ? "animate-spin" : ""}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-800">Actualizar Sistema</p>
            <p className="text-[11px] text-neutral-500">Descargá la última versión de HABA</p>
          </div>
        </div>
        <button
          disabled={updating}
          onClick={async () => {
            setUpdating(true);
            try {
              // 1. Desregistrar todos los service workers
              if ("serviceWorker" in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                  await reg.unregister();
                }
              }
              // 2. Limpiar todos los caches del navegador
              if ("caches" in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                  await caches.delete(name);
                }
              }
              // 3. Esperar un momento y hacer hard reload
              await new Promise((r) => setTimeout(r, 500));
              window.location.reload();
            } catch (err) {
              console.error("Error al actualizar:", err);
              window.location.reload();
            }
          }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition disabled:opacity-60"
        >
          {updating ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* Botón Cerrar Sesión */}
      <div className="pt-1">
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-semibold rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Pie de versión */}
      <div className="text-center pt-2 text-[10px] text-neutral-400">
        HABA v0.1 · Tu aliado en cada receta y presupuesto 🌱
      </div>
    </div>
  );
}
