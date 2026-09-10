"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Por favor completá tu email y contraseña");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Email o contraseña incorrectos. Revisá tus datos.");
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      if (data?.user) {
        // Verificar si la cuenta está suspendida ("apagada" por Gio)
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, role")
          .eq("id", data.user.id)
          .single();

        if (profile?.status === "suspended") {
          await supabase.auth.signOut();
          setErrorMessage(
            "Tu cuenta se encuentra en pausa. Contactate con Gio (Amaoto Craft) para reactivarla."
          );
          return;
        }

        router.push("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage("Ocurrió un error inesperado al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm mx-auto py-8">
      {/* Header & Mascota */}
      <div className="flex flex-col items-center text-center mb-6">
        <HabaMascot size={110} className="mb-2" />
        <h1 className="text-3xl font-extrabold text-[#3BB578] tracking-tight">
          HABA
        </h1>
        <h2 className="text-xl font-bold text-neutral-700 mt-2">
          ¡Qué bueno verte!
        </h2>
        <p className="text-sm text-neutral-500 max-w-[260px] mt-1">
          Tu aliado para calcular costos, fijar precios y armar presupuestos.
        </p>
      </div>

      {/* Form Card */}
      <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-[#EAF0E8]">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mensaje de Error */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-600">
              Email o usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@email.com"
                required
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-600">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Recordarme y Olvidé contraseña */}
          <div className="flex items-center justify-between text-xs pt-1 text-neutral-600">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#3BB578] focus:ring-[#3BB578] accent-[#3BB578]"
              />
              <span>Recordarme</span>
            </label>
            <button
              type="button"
              onClick={() =>
                alert("Contactate con Gio de Amaoto Craft para restablecer tu acceso.")
              }
              className="text-[#3BB578] hover:underline font-medium"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Botón Principal */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white font-semibold rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-sm">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Ingresando...
              </span>
            ) : (
              <span>Iniciar sesión</span>
            )}
          </button>
        </form>

        {/* Info suscripción / Gio */}
        <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
          <p className="text-xs text-neutral-500">
            ¿Primera vez en HABA?
          </p>
          <p className="text-xs text-[#3BB578] font-semibold mt-0.5 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Las altas se activan con tu suscripción a Amaoto Craft
          </p>
        </div>
      </div>

      {/* Footer mascota tip */}
      <div className="mt-6 text-center text-xs text-neutral-400">
        Vos contame qué hacés. Haba hace las cuentas. 🌱
      </div>
    </div>
  );
}
