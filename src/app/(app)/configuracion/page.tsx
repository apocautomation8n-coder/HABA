"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Store, Mail, ShieldCheck, LogOut, Check, Sparkles } from "lucide-react";
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
      <div className="flex items-center gap-3.5 bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm">
        <HabaMascot size={60} />
        <div>
          <h2 className="text-base font-bold text-neutral-800">
            {fullName || "Mi Perfil"}
          </h2>
          <p className="text-xs text-neutral-500">{email}</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#306236] bg-[#e5f2e6] px-2 py-0.5 rounded-full font-semibold mt-1">
            <ShieldCheck className="w-3 h-3" />
            {role === "admin" ? "SuperAdmin Gio" : "Cuenta Emprendedora"}
          </span>
        </div>
      </div>

      {/* Formulario de Emprendimiento */}
      <div className="bg-white p-5 rounded-3xl border border-[#eef2eb] shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3.5">
          Datos de tu Negocio
        </h3>
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#3b7c42]" />
              Nombre del Emprendimiento
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Amaoto Craft, Mis Creaciones..."
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none transition"
            />
            <p className="text-[10px] text-neutral-400">
              Este nombre aparecerá en el encabezado de tus presupuestos.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#3b7c42]" />
              Tu Nombre Completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Giulianna Penna"
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none transition"
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
            className="w-full py-2.5 px-4 bg-[#3b7c42] hover:bg-[#326b38] text-white font-semibold rounded-2xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-sm"
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

      {/* Botón Cerrar Sesión */}
      <div className="pt-2">
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
