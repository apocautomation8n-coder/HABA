"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Store,
  Mail,
  ShieldCheck,
  LogOut,
  Check,
  Sparkles,
  Smartphone,
  Bell,
  Clock,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Calendar,
  Loader2,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/auth-helpers";
import {
  PlanType,
  AccountStatus,
  PLAN_NAMES,
  ACCOUNT_STATUS_NAMES,
  getPlanStatusInfo,
  formatDateDisplay,
  calculatePlanEndDate,
} from "@/lib/plan-helpers";

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
  const [newPassword, setNewPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [role, setRole] = useState<string>("user");
  const [priceReviewDays, setPriceReviewDays] = useState<number>(15);
  const [savedNotifSuccess, setSavedNotifSuccess] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Foto de perfil o logo
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Datos del Plan
  const [planType, setPlanType] = useState<PlanType>("prueba");
  const [planStartDate, setPlanStartDate] = useState<string>("");
  const [planEndDate, setPlanEndDate] = useState<string>("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");

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

          if (checkIsAdmin(user)) {
            setRole("admin");
          }

          if (user.user_metadata?.full_name) {
            setFullName(user.user_metadata.full_name);
          }
          if (user.user_metadata?.business_name) {
            setBusinessName(user.user_metadata.business_name);
          }
          if (user.user_metadata?.avatar_url) {
            setAvatarUrl(user.user_metadata.avatar_url);
          }
          if (user.user_metadata?.plan_type) {
            setPlanType(user.user_metadata.plan_type);
          }
          if (user.user_metadata?.plan_start_date) {
            setPlanStartDate(user.user_metadata.plan_start_date);
          }
          if (user.user_metadata?.plan_end_date) {
            setPlanEndDate(user.user_metadata.plan_end_date);
          }
          if (user.user_metadata?.account_status) {
            setAccountStatus(user.user_metadata.account_status);
          }

          // Cargar perfil desde API segura (bypasea RLS recursivo)
          try {
            const res = await fetch("/api/user/profile");
            if (res.ok) {
              const data = await res.json();
              if (data.isAdmin) setRole("admin");
              if (data.profile?.full_name) setFullName(data.profile.full_name);
              if (data.profile?.business_name) setBusinessName(data.profile.business_name);
              if (data.profile?.role) setRole(data.profile.role);
              if (data.profile?.avatar_url) setAvatarUrl(data.profile.avatar_url);
              if (data.profile?.plan_type) setPlanType(data.profile.plan_type);
              if (data.profile?.plan_start_date) setPlanStartDate(data.profile.plan_start_date);
              if (data.profile?.plan_end_date) setPlanEndDate(data.profile.plan_end_date);
              if (data.profile?.account_status) setAccountStatus(data.profile.account_status);
            }
          } catch {
            // ignore
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

  // Subir foto de perfil o logo
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no debe superar los 5MB.");
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Error al subir la imagen");
      }

      setAvatarUrl(resJson.avatarUrl);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Quitar foto de perfil o logo
  const handleRemoveAvatar = async () => {
    if (!window.confirm("¿Querés quitar tu foto de perfil o logo?")) return;
    try {
      setUploadingAvatar(true);
      const res = await fetch("/api/user/avatar", {
        method: "DELETE",
      });
      if (res.ok) {
        setAvatarUrl(null);
      } else {
        const data = await res.json();
        alert("Error: " + (data.error || "No se pudo quitar"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    if (newPassword.trim() && newPassword.trim().length < 6) {
      alert("La nueva contraseña debe tener al menos 6 caracteres.");
      setSaving(false);
      return;
    }

    try {
      const payload: Record<string, any> = {
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        email: email.trim(),
      };
      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setNewPassword("");
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        const data = await res.json();
        alert("Error al guardar perfil: " + (data.error || "Reintentá"));
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

  const planStatusInfo = getPlanStatusInfo(planEndDate);

  return (
    <div className="w-full flex flex-col space-y-5 font-body pb-8">
      {/* Header Perfil con Foto de Perfil o Logo */}
      <div className="flex items-center gap-4 bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm">
        <div className="relative group flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Logo o Foto"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#3BB578] shadow-xs"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#DCF4D7] border-2 border-[#C3EBC0] flex items-center justify-center text-[#1F7A4C] font-bold text-xl shadow-xs">
              <HabaMascot size={46} />
            </div>
          )}

          {/* Botón interactivo de cambiar foto */}
          <label
            htmlFor="avatar-upload-input"
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-full flex items-center justify-center cursor-pointer shadow-md transition active:scale-95"
            title="Elegir foto de perfil o logo"
          >
            {uploadingAvatar ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
          </label>
          <input
            id="avatar-upload-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={uploadingAvatar}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-neutral-800 truncate font-display">
              {fullName || businessName || "Mi Perfil"}
            </h2>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-[10.5px] text-neutral-400 hover:text-rose-600 transition"
              >
                Quitar foto
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-500 truncate">{email}</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full font-semibold mt-1">
            <ShieldCheck className="w-3 h-3" />
            {role === "admin" ? "SuperAdmin Gio" : "Cuenta Emprendedora"}
          </span>
        </div>
      </div>

      {/* Enlace al panel de administración si es Admin */}
      {role === "admin" && (
        <Link
          href="/admin"
          className="bg-gradient-to-r from-[#DCF4D7] via-white to-[#DCF4D7]/70 border-2 border-[#3BB578] p-4 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3BB578] text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1F7A4C] font-display">Panel SuperAdmin Gio</p>
              <p className="text-xs text-[#2B2B2B]">Gestionar usuarias, planes y vigencias</p>
            </div>
          </div>
          <span className="px-3.5 py-2 bg-[#3BB578] group-hover:bg-[#2E9E65] text-white font-bold rounded-2xl text-xs transition shadow-xs">
            Abrir Panel →
          </span>
        </Link>
      )}

      {/* Tarjeta Estado de Mi Plan */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-3 font-body">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                Tu Suscripción
              </h3>
              <p className="text-sm font-bold text-[#2B2B2B] font-display">
                Plan {PLAN_NAMES[planType] || planType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Badge estado del plan */}
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${planStatusInfo.badgeBg} ${planStatusInfo.badgeText} ${planStatusInfo.badgeBorder}`}
            >
              {planStatusInfo.label}
            </span>

            {/* Badge estado de cuenta */}
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                accountStatus === "active"
                  ? "bg-[#DCF4D7] text-[#1F7A4C]"
                  : accountStatus === "suspended"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              Cuenta {ACCOUNT_STATUS_NAMES[accountStatus] || accountStatus}
            </span>
          </div>
        </div>

        <div className="p-3 bg-[#F6F7F2] rounded-2xl border border-[#EAF0E8] space-y-2 text-xs">
          <div className="flex items-center justify-between text-neutral-600">
            <span className="text-[11px] text-[#7A7A7A]">Fecha de inicio:</span>
            <span className="font-bold text-[#2B2B2B]">
              {formatDateDisplay(planStartDate)}
            </span>
          </div>

          <div className="flex items-center justify-between text-neutral-600">
            <span className="text-[11px] text-[#7A7A7A]">Fecha de vencimiento:</span>
            <span className="font-bold text-[#2B2B2B]">
              {formatDateDisplay(planEndDate)}
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between">
            <span className="text-[11px] text-[#7A7A7A] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              Vigencia restante:
            </span>
            <span className={`font-bold ${planStatusInfo.badgeText}`}>
              {planStatusInfo.rowText}
            </span>
          </div>
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

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#3BB578]" />
              Email de acceso
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition text-neutral-800"
            />
            <p className="text-[10px] text-neutral-400">
              Es el correo con el que iniciás sesión en HABA.
            </p>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#3BB578]" />
              Cambiar Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Dejalo en blanco si no querés cambiarla"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition text-neutral-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">
              Escribí una nueva clave (mín. 6 caracteres) solo si deseás cambiar tu contraseña.
            </p>
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
              alert(
                "Para instalar en iPhone: Toca el botón Compartir en Safari y luego 'Agregar a pantalla de inicio'. En Android: Toca el menú de 3 puntos y 'Instalar aplicación'."
              );
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
              if ("serviceWorker" in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                  await reg.unregister();
                }
              }
              if ("caches" in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                  await caches.delete(name);
                }
              }
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

      {/* Footer versión */}
      <div className="text-center pt-2 pb-6 text-[11px] text-neutral-400">
        HABA v0.1 · Tu aliado en cada producto y presupuesto 🌱
      </div>
    </div>
  );
}
