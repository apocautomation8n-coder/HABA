"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  User,
  Store,
  Phone,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { buildInitialUserMetadata } from "@/lib/plan-helpers";
import { TERMS_VERSION, isTermsEnabled } from "@/lib/terms";

export default function RegistroPage() {
  const router = useRouter();
  const supabase = createClient();

  // Form State
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Honeypot anti-bots (campo señuelo que los humanos no completan)
  const [honeypot, setHoneypot] = useState("");
  // Timestamp de montaje para mitigar envíos ultrarrápidos de scripts automatizados
  const [mountTime, setMountTime] = useState<number>(Date.now());

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(true);

  useEffect(() => {
    setMountTime(Date.now());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Anti-bot honeypot check
    if (honeypot.trim() !== "") {
      // Simular éxito silencioso ante bots sin tocar la base de datos
      setIsSuccess(true);
      setSuccessEmail(email);
      return;
    }

    // 2. Anti-spam fast-submit check (mínimo 1.2 segundos en pantalla)
    const elapsed = Date.now() - mountTime;
    if (elapsed < 1200) {
      setErrorMessage("Por favor completá el formulario de forma manual.");
      return;
    }

    // 3. Validaciones de campos
    const cleanFullName = fullName.trim();
    const cleanBusinessName = businessName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName) {
      setErrorMessage("Por favor ingresá tu nombre y apellido.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Por favor ingresá un correo electrónico válido.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (isTermsEnabled() && !acceptedTerms) {
      setErrorMessage("Es obligatorio leer y aceptar las Bases y Condiciones para registrarte.");
      return;
    }

    try {
      setLoading(true);

      // Metadatos iniciales centralizados de T5 (Prueba 15 días, activa, flag nueva)
      const initialPlanMeta = buildInitialUserMetadata({
        planType: "prueba",
        isNew: true,
        registrationSource: "public",
        termsVersion: isTermsEnabled() ? TERMS_VERSION : null,
        termsAcceptedAt: isTermsEnabled() && acceptedTerms ? new Date().toISOString() : null,
      });

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
            business_name: cleanBusinessName || cleanFullName,
            phone: cleanPhone || null,
            business_phone: cleanPhone || null,
            ...initialPlanMeta,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("already registered") ||
          msg.includes("already in use") ||
          msg.includes("user already exists") ||
          error.status === 422
        ) {
          setErrorMessage(
            "Ya existe una cuenta registrada con este correo electrónico. Si es tuya, podés iniciar sesión o restablecer tu contraseña."
          );
        } else {
          setErrorMessage(error.message || "No se pudo completar el registro.");
        }
        return;
      }

      // Verificación de email duplicado cuando Supabase tiene habilitada la protección de enumeración
      if (
        data?.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setErrorMessage(
          "Ya existe una cuenta registrada con este correo electrónico. Si es tuya, podés iniciar sesión o restablecer tu contraseña."
        );
        return;
      }

      // Registro exitoso
      setSuccessEmail(cleanEmail);

      // Si Supabase no requiere confirmación de email y devuelve sesión activa de inmediato
      if (data?.session) {
        setRequiresEmailConfirmation(false);
        setIsSuccess(true);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      } else {
        // Requiere confirmación por correo
        setRequiresEmailConfirmation(true);
        setIsSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage("Ocurrió un error inesperado al procesar el registro.");
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de Éxito
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md mx-auto py-10 px-4">
        <div className="w-full bg-white rounded-3xl p-8 shadow-sm border border-[#EAF0E8] text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-neutral-800">
              {requiresEmailConfirmation ? "¡Casi listo!" : "¡Bienvenida a HABA!"}
            </h1>
            <p className="text-xs text-[#3BB578] font-bold mt-1 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Tus 15 días de prueba gratis están activados
            </p>
          </div>

          {requiresEmailConfirmation ? (
            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 text-xs text-neutral-600 space-y-2 text-left">
              <p>
                Te enviamos un enlace de confirmación a:
              </p>
              <p className="font-bold text-[#1F7A4C] break-all bg-white px-3 py-2 rounded-xl border border-[#C3EBC0]">
                {successEmail}
              </p>
              <p className="text-[11px] text-neutral-500 pt-1">
                Revisá tu bandeja de entrada (y también la carpeta de correo no deseado o spam) para activar tu cuenta e ingresar.
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-600">
              Tu cuenta ya está lista. Te estamos redirigiendo a tu panel...
            </p>
          )}

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full py-3 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2 text-xs"
            >
              <span>Ir a Iniciar Sesión</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-400">
          Vos contame qué hacés. Haba hace las cuentas. 🌱
        </div>
      </div>
    );
  }

  // Pantalla del Formulario
  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md mx-auto py-8 px-4">
      {/* Header & Mascota */}
      <div className="flex flex-col items-center text-center mb-6">
        <HabaMascot size={90} className="mb-1" />
        <h1 className="text-2xl font-extrabold text-[#3BB578] tracking-tight">
          Creá tu cuenta en HABA
        </h1>
        <p className="text-xs text-neutral-500 max-w-[290px] mt-1">
          Probá gratis por 15 días todas las herramientas para costear, presupuestar y fijar precios.
        </p>
      </div>

      {/* Tarjeta del Formulario */}
      <div className="w-full bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#EAF0E8]">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot oculto para capturar bots */}
          <div aria-hidden="true" className="opacity-0 absolute -left-[9999px] pointer-events-none -z-50">
            <input
              type="text"
              name="company_website_url"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Mensaje de Error */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <div className="leading-snug space-y-1">
                <span>{errorMessage}</span>
                {errorMessage.includes("Ya existe una cuenta") && (
                  <div className="pt-1">
                    <Link
                      href="/login"
                      className="font-bold underline text-[#1F7A4C] hover:text-[#185E3B]"
                    >
                      Iniciar sesión con mi cuenta existente →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nombre y Apellido */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              Nombre y apellido <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Paula Gómez"
                required
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
          </div>

          {/* Nombre del Emprendimiento */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              Nombre de tu emprendimiento
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Store className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej. Paula Deco Taller"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
          </div>

          {/* Teléfono / WhatsApp */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              WhatsApp / Teléfono
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 5491123456789"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
            <span className="text-[10px] text-neutral-400 block pl-1">
              Para contacto o presupuestos comerciales
            </span>
          </div>

          {/* Correo Electrónico */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              Correo electrónico <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              Contraseña <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Checkbox Términos y Condiciones (T3) */}
          {isTermsEnabled() && (
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 rounded text-[#3BB578] focus:ring-[#3BB578] accent-[#3BB578] flex-shrink-0 cursor-pointer"
                />
                <span className="text-[11px] text-neutral-600 leading-tight">
                  He leído y acepto las{" "}
                  <Link
                    href="/terminos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1F7A4C] hover:text-[#185E3B] font-bold underline underline-offset-2"
                  >
                    Bases y Condiciones
                  </Link>{" "}
                  del servicio.
                </span>
              </label>
            </div>
          )}

          {/* Botón Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white font-bold rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-xs">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creando tu cuenta...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Comenzar 15 días gratis</span>
              </span>
            )}
          </button>
        </form>

        {/* Link a Login */}
        <div className="mt-5 pt-4 border-t border-neutral-100 text-center">
          <p className="text-xs text-neutral-600">
            ¿Ya tenés una cuenta?{" "}
            <Link
              href="/login"
              className="text-[#1F7A4C] hover:text-[#185E3B] font-bold underline underline-offset-2 transition"
            >
              Iniciá sesión acá
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-neutral-400">
        Vos contame qué hacés. Haba hace las cuentas. 🌱
      </div>
    </div>
  );
}
