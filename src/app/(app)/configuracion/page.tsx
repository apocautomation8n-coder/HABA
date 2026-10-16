"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  ExternalLink,
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
  DollarSign,
  Calculator,
  AlertCircle,
  Phone,
  MapPin,
  AtSign,
  Copy,
  Hash,
  Palette,
  Pipette,
  Globe,
} from "lucide-react";
import { ProfileAvatar, isRealUserAvatar } from "@/components/ProfileAvatar";
import { HabaMascot } from "@/components/HabaMascot";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { buildProfileSupportWhatsAppUrl } from "@/lib/support";
import { isTermsEnabled } from "@/lib/terms";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { COUNTRY_PRESETS } from "@/lib/units";
import { useFormatPrefs } from "@/hooks/useFormatPrefs";
import { QUOTE_COLOR_PALETTES, getQuoteTheme, normalizeHexColor } from "@/lib/quotes";
import {
  PlanType,
  AccountStatus,
  PLAN_NAMES,
  ACCOUNT_STATUS_NAMES,
  getPlanStatusInfo,
  formatDateDisplay,
  calculatePlanEndDate,
  getTrustedPlanMeta,
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
  const [businessRubro, setBusinessRubro] = useState<string>("");
  const [quoteColor, setQuoteColor] = useState<string>("corporate");
  const [customHexInput, setCustomHexInput] = useState<string>("#1F7A4C");
  const [businessPhone, setBusinessPhone] = useState<string>("");
  const [businessEmail, setBusinessEmail] = useState<string>("");
  const [instagram, setInstagram] = useState<string>("");
  const [address, setAddress] = useState<string>("");
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
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [copiedAccountNum, setCopiedAccountNum] = useState<boolean>(false);

  // Preferencias de formato y moneda (T4)
  const { formatMoney, formatNumber, parseNumber, setFormatPrefs: updateGlobalFormatPrefs } = useFormatPrefs();
  const [currency, setCurrency] = useState<string>("ARS");
  const [numberLocale, setNumberLocale] = useState<string>("es-AR");
  const [decimals, setDecimals] = useState<number>(2);

  // Mano de Obra y Sueldo Pretendido (Punto 4)
  const [salary, setSalary] = useState<number | string>("");
  const [daysPerMonth, setDaysPerMonth] = useState<number | string>(20);
  const [hoursPerDay, setHoursPerDay] = useState<number | string>(6);
  const [fixedExpensesTotal, setFixedExpensesTotal] = useState<number>(0);
  const [savingLabor, setSavingLabor] = useState<boolean>(false);
  const [laborSavedSuccess, setLaborSavedSuccess] = useState<boolean>(false);
  const [laborError, setLaborError] = useState<string | null>(null);
  const [subscribingMP, setSubscribingMP] = useState<boolean>(false);
  const [syncingMP, setSyncingMP] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [showCustomPayerEmail, setShowCustomPayerEmail] = useState<boolean>(false);
  const [customPayerEmail, setCustomPayerEmail] = useState<string>("");

  const handleSubscribeMercadoPago = async () => {
    try {
      setSubscribingMP(true);
      const payload: Record<string, any> = { return_url: "/configuracion?status=approved" };
      if (customPayerEmail.trim()) {
        payload.payer_email = customPayerEmail.trim();
      }
      const res = await fetch("/api/mercadopago/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(data.error || "No se pudo conectar con Mercado Pago.");
        setSubscribingMP(false);
      }
    } catch {
      alert("Error al conectar con la pasarela de pago.");
      setSubscribingMP(false);
    }
  };

  const handleSyncMercadoPago = async (silent = false) => {
    try {
      if (!silent) setSyncingMP(true);
      setSyncNotice(null);
      let res = await fetch("/api/mercadopago/sync", { method: "POST" });
      let data = await res.json();

      // Si no detectó la suscripción automáticamente con su email de HABA y fue acción manual
      if (!data.synced && !silent) {
        const customEmail = window.prompt(
          `No detectamos un cobro en Mercado Pago asociado a tu email de HABA (${email || "tu cuenta"}).\n\nSi pagaste desde una cuenta de Mercado Pago con OTRO email (ej: cuenta personal o de un familiar) o querés vincularlo por N° de operación, ingresalo acá:`
        );
        if (customEmail && customEmail.trim()) {
          setSyncingMP(true);
          res = await fetch("/api/mercadopago/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payer_email: customEmail.trim() }),
          });
          data = await res.json();
        }
      }

      if (data.synced) {
        if (data.plan_type) setPlanType(data.plan_type);
        if (data.plan_end_date) setPlanEndDate(data.plan_end_date);
        setSyncNotice("¡Tu suscripción mensual fue verificada y activada con éxito!");
        if (!silent) {
          alert("¡Suscripción mensual verificada y activada con éxito!");
        }
      } else if (!silent) {
        alert(
          data.error ||
            "Aún no detectamos la aprobación del cobro en Mercado Pago. Si acabás de pagar, por favor aguardá 1 minuto y volvé a presionar el botón."
        );
      }
    } catch (err: any) {
      if (!silent) alert("Error al sincronizar con Mercado Pago.");
    } finally {
      if (!silent) setSyncingMP(false);
    }
  };

  // Enlace dinámico de WhatsApp para soporte HABA (null si NEXT_PUBLIC_SUPPORT_WHATSAPP no está configurada)
  const supportWhatsAppUrl = buildProfileSupportWhatsAppUrl({
    accountNumber,
    businessName,
    fullName,
  });

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
          if (user.user_metadata?.business_rubro) {
            setBusinessRubro(user.user_metadata.business_rubro);
          }
          if (user.user_metadata?.quote_primary_color) {
            setQuoteColor(user.user_metadata.quote_primary_color);
            const initialHex = normalizeHexColor(user.user_metadata.quote_primary_color) || getQuoteTheme(user.user_metadata.quote_primary_color).primary;
            setCustomHexInput(initialHex.toUpperCase());
          } else {
            const savedColor = typeof window !== "undefined" ? localStorage.getItem("haba_quote_primary_color") : null;
            if (savedColor) {
              setQuoteColor(savedColor);
              const initialHex = normalizeHexColor(savedColor) || getQuoteTheme(savedColor).primary;
              setCustomHexInput(initialHex.toUpperCase());
            }
          }
          if (user.user_metadata?.business_phone || user.user_metadata?.phone) {
            setBusinessPhone(user.user_metadata.business_phone || user.user_metadata.phone);
          }
          if (user.user_metadata?.business_email) {
            setBusinessEmail(user.user_metadata.business_email);
          }
          if (user.user_metadata?.instagram) {
            setInstagram(user.user_metadata.instagram);
          }
          if (user.user_metadata?.address) {
            setAddress(user.user_metadata.address);
          }
          if (user.user_metadata?.avatar_url) {
            setAvatarUrl(user.user_metadata.avatar_url);
          }
          // Datos del plan: solo desde app_metadata (user_metadata lo puede editar la usuaria)
          const trustedPlan = getTrustedPlanMeta(user);
          setPlanType(trustedPlan.plan_type);
          setPlanStartDate(trustedPlan.plan_start_date);
          setPlanEndDate(trustedPlan.plan_end_date);
          setAccountStatus(trustedPlan.account_status);
          if (user.user_metadata?.account_number) {
            setAccountNumber(user.user_metadata.account_number);
          }

          if (user.user_metadata?.currency) {
            setCurrency(user.user_metadata.currency);
          }
          if (user.user_metadata?.number_locale || user.user_metadata?.numberLocale) {
            setNumberLocale(user.user_metadata.number_locale || user.user_metadata.numberLocale);
          }
          if (typeof user.user_metadata?.decimals === "number") {
            setDecimals(user.user_metadata.decimals);
          }

          // Cargar perfil desde API segura (bypasea RLS recursivo)
          try {
            const res = await fetch("/api/user/profile");
            if (res.ok) {
              const data = await res.json();
              if (data.isAdmin) setRole("admin");
              if (data.profile?.currency) setCurrency(data.profile.currency);
              if (data.profile?.number_locale) setNumberLocale(data.profile.number_locale);
              if (typeof data.profile?.decimals === "number") setDecimals(data.profile.decimals);
              if (data.profile?.full_name) setFullName(data.profile.full_name);
              if (data.profile?.business_name) setBusinessName(data.profile.business_name);
              if (data.profile?.business_rubro) setBusinessRubro(data.profile.business_rubro);
              if (data.profile?.quote_primary_color) {
                setQuoteColor(data.profile.quote_primary_color);
                const initialHex = normalizeHexColor(data.profile.quote_primary_color) || getQuoteTheme(data.profile.quote_primary_color).primary;
                setCustomHexInput(initialHex.toUpperCase());
              }
              if (data.profile?.business_phone || data.profile?.phone) {
                setBusinessPhone(data.profile.business_phone || data.profile.phone);
              }
              if (data.profile?.business_email) {
                setBusinessEmail(data.profile.business_email);
              }
              if (data.profile?.instagram) {
                setInstagram(data.profile.instagram);
              }
              if (data.profile?.address) {
                setAddress(data.profile.address);
              }
              if (data.profile?.role) setRole(data.profile.role);
              if (data.profile?.avatar_url) setAvatarUrl(data.profile.avatar_url);
              if (data.profile?.plan_type) setPlanType(data.profile.plan_type);
              if (data.profile?.plan_start_date) setPlanStartDate(data.profile.plan_start_date);
              if (data.profile?.plan_end_date) setPlanEndDate(data.profile.plan_end_date);
              if (data.profile?.account_status) setAccountStatus(data.profile.account_status);
              if (data.profile?.account_number) setAccountNumber(data.profile.account_number);

              // Si volvio de abonar en Mercado Pago, sincronizar automaticamente y limpiar URL
              if (
                typeof window !== "undefined" &&
                (window.location.search.includes("status=approved") ||
                  window.location.search.includes("preapproval_id"))
              ) {
                try {
                  window.history.replaceState({}, document.title, window.location.pathname);
                } catch {
                  // ignore
                }
                handleSyncMercadoPago(true);
              }
            }
          } catch {
            // ignore
          }

          // Cargar configuración de mano de obra
          try {
            const { data: laborData } = await supabase
              .from("labor_settings")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle();

            if (laborData) {
              if (laborData.desired_monthly_salary !== undefined && laborData.desired_monthly_salary !== null && laborData.desired_monthly_salary > 0) {
                setSalary(laborData.desired_monthly_salary);
              } else {
                setSalary("");
              }
              if (laborData.working_days_per_month) {
                setDaysPerMonth(laborData.working_days_per_month);
              }
              if (laborData.working_hours_per_day) {
                setHoursPerDay(laborData.working_hours_per_day);
              }
            } else {
              setSalary("");
            }
          } catch {
            // ignore
          }

          // Cargar total de gastos fijos para calcular objetivo mensual real
          try {
            const { data: expData } = await supabase
              .from("fixed_expenses")
              .select("monthly_equivalent");
            if (expData) {
              const totalExp = expData.reduce((acc, curr) => acc + Number(curr.monthly_equivalent || 0), 0);
              setFixedExpensesTotal(totalExp);
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

  const selectedCountry = useMemo(() => {
    const match = COUNTRY_PRESETS.find(
      (c) =>
        c.currency.toUpperCase() === currency.toUpperCase() &&
        c.numberLocale.toLowerCase() === numberLocale.toLowerCase() &&
        c.decimals === decimals
    );
    return match ? match.countryCode : "custom";
  }, [currency, numberLocale, decimals]);

  const handleCountryChange = (code: string) => {
    if (code === "custom") return;
    const match = COUNTRY_PRESETS.find((c) => c.countryCode === code);
    if (match) {
      setCurrency(match.currency);
      setNumberLocale(match.numberLocale);
      setDecimals(match.decimals);
    }
  };

  // Formateo con puntos o comas de miles para valores monetarios enteros
  const formatThousands = (val: number | string) => {
    if (val === "" || val === null || val === undefined) return "";
    const clean = String(val).replace(/\D/g, "");
    if (!clean) return "";
    return formatNumber(parseInt(clean, 10), { decimals: 0, locale: numberLocale });
  };

  // Cálculos de Objetivo Mensual y Valor Hora/Minuto
  const parsedSalary = parseNumber(salary, { numberLocale });
  const numDays = typeof daysPerMonth === "number" ? daysPerMonth : parseFloat(String(daysPerMonth)) || 0;
  const numHours = typeof hoursPerDay === "number" ? hoursPerDay : parseFloat(String(hoursPerDay)) || 0;
  const totalHoursPerMonth = numDays * numHours;
  const objetivoMensual = parsedSalary + fixedExpensesTotal;
  const hasSalary = salary !== "" && salary !== null && salary !== undefined && parsedSalary > 0;
  const calculatedHourlyRate = hasSalary && totalHoursPerMonth > 0 ? objetivoMensual / totalHoursPerMonth : 0;
  const calculatedMinuteRate = calculatedHourlyRate / 60;

  // Guardar mano de obra y sueldo pretendido
  const handleSaveLabor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaborError(null);

    if (parsedSalary < 0) {
      setLaborError("El sueldo pretendido no puede ser negativo.");
      return;
    }
    if (numDays < 1 || numDays > 31) {
      setLaborError("Los días trabajados al mes deben estar entre 1 y 31.");
      return;
    }
    if (numHours <= 0 || numHours > 24) {
      setLaborError("Las horas diarias de trabajo deben estar entre 1 y 24.");
      return;
    }

    try {
      setSavingLabor(true);
      setLaborSavedSuccess(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("No hay una sesión activa.");

      const now = new Date().toISOString();
      const { error: upsertError } = await supabase.from("labor_settings").upsert(
        {
          user_id: user.id,
          desired_monthly_salary: parsedSalary,
          working_days_per_month: numDays,
          working_hours_per_day: numHours,
          hourly_rate: calculatedHourlyRate,
          minute_rate: calculatedMinuteRate,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

      if (upsertError) throw upsertError;

      setLaborSavedSuccess(true);
      setTimeout(() => setLaborSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving labor settings:", err);
      setLaborError(err.message || "Error al guardar configuración.");
    } finally {
      setSavingLabor(false);
    }
  };

  // Copiar número de cuenta al portapapeles
  const handleCopyAccountNumber = () => {
    if (!accountNumber) return;
    navigator.clipboard.writeText(accountNumber);
    setCopiedAccountNum(true);
    setTimeout(() => setCopiedAccountNum(false), 2000);
  };

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

  const currentQuoteTheme = getQuoteTheme(quoteColor);
  const activeQuoteHex = (normalizeHexColor(quoteColor) || currentQuoteTheme.primary || "#1F7A4C").toUpperCase();
  const matchingPreset = QUOTE_COLOR_PALETTES.find(
    (p) =>
      quoteColor.toLowerCase() === p.id.toLowerCase() ||
      quoteColor.toLowerCase() === p.primary.toLowerCase()
  );
  const isCustomQuoteActive = !matchingPreset;

  const handleSelectPreset = (palette: (typeof QUOTE_COLOR_PALETTES)[number]) => {
    setQuoteColor(palette.primary);
    setCustomHexInput(palette.primary.toUpperCase());
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value.toUpperCase();
    setQuoteColor(hex);
    setCustomHexInput(hex);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.trim();
    if (raw.length > 0 && !raw.startsWith("#")) {
      raw = `#${raw}`;
    }
    raw = raw.toUpperCase().slice(0, 7);
    setCustomHexInput(raw);

    const validHex = normalizeHexColor(raw);
    if (validHex) {
      setQuoteColor(validHex);
    }
  };

  const handleHexInputBlur = () => {
    const validHex = normalizeHexColor(customHexInput);
    if (validHex) {
      setQuoteColor(validHex);
      setCustomHexInput(validHex);
    } else {
      setCustomHexInput(activeQuoteHex);
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
      const finalHex = normalizeHexColor(quoteColor) || currentQuoteTheme.primary || "#1F7A4C";
      const payload: Record<string, any> = {
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        businessRubro: businessRubro.trim(),
        quotePrimaryColor: finalHex,
        email: email.trim(),
        businessPhone: businessPhone.trim(),
        businessEmail: businessEmail.trim(),
        instagram: instagram.trim(),
        address: address.trim(),
        currency: currency.trim().toUpperCase(),
        numberLocale: numberLocale.trim(),
        decimals: Number(decimals),
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
        updateGlobalFormatPrefs({
          currency: currency.trim().toUpperCase(),
          numberLocale: numberLocale.trim(),
          decimals: Number(decimals),
        });
        if (typeof window !== "undefined") {
          localStorage.setItem("haba_quote_primary_color", finalHex);
          localStorage.setItem("haba_business_rubro", businessRubro.trim());
          localStorage.setItem(
            "haba_format_prefs",
            JSON.stringify({
              currency: currency.trim().toUpperCase(),
              numberLocale: numberLocale.trim(),
              decimals: Number(decimals),
            })
          );
          window.dispatchEvent(new CustomEvent("haba-profile-updated"));
          window.dispatchEvent(new CustomEvent("haba-format-prefs-updated"));
        }
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
          <ProfileAvatar
            url={avatarUrl}
            alt={fullName || businessName || "Foto de perfil o logo"}
            className="w-16 h-16 rounded-2xl"
            iconSize={32}
          />

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
            {avatarUrl && isRealUserAvatar(avatarUrl) && (
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] text-[#1F7A4C] bg-[#DCF4D7] px-2 py-0.5 rounded-full font-semibold">
              <ShieldCheck className="w-3 h-3" />
              {role === "admin" ? "SuperAdmin Gio" : "Cuenta Emprendedora"}
            </span>
            {accountNumber && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
                <Hash className="w-3 h-3 text-[#3BB578]" />
                {accountNumber}
              </span>
            )}
          </div>
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

          {/* Aviso de sincronización exitosa */}
          {syncNotice && (
            <div className="p-3 bg-[#DCF4D7] border border-[#C3EBC0] rounded-2xl text-xs text-[#1F7A4C] font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{syncNotice}</span>
            </div>
          )}

          {role !== "admin" && (
            <div className="pt-2.5 border-t border-neutral-200/60 space-y-2">
              <button
                type="button"
                onClick={handleSubscribeMercadoPago}
                disabled={subscribingMP}
                className="w-full py-2.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] active:scale-[0.99] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-75"
              >
                {subscribingMP ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Conectando con Mercado Pago...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span>
                      {planType === "mensual" && planStatusInfo.status === "vigente"
                        ? "Renovar / Extender Plan (+30 días)"
                        : "Suscribirme al Plan Mensual (Mercado Pago)"}
                    </span>
                    <ExternalLink className="w-3 h-3 text-white/80" />
                  </>
                )}
              </button>

              {/* Opción si paga con otra cuenta de Mercado Pago */}
              <div className="pt-0.5 text-center">
                {!showCustomPayerEmail ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomPayerEmail(true)}
                    className="text-[10px] text-neutral-500 hover:text-[#1F7A4C] transition underline"
                  >
                    ¿Vas a pagar con una cuenta de Mercado Pago con otro e-mail?
                  </button>
                ) : (
                  <div className="p-2.5 bg-white rounded-xl border border-neutral-200 text-left space-y-1 animate-in fade-in">
                    <label className="text-[10.5px] font-semibold text-[#2B2B2B] block">
                      E-mail de tu cuenta de Mercado Pago:
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        value={customPayerEmail}
                        onChange={(e) => setCustomPayerEmail(e.target.value)}
                        placeholder="ej: tu_mercadopago@gmail.com"
                        className="flex-1 px-2.5 py-1 text-xs bg-[#F6F7F2] border border-neutral-200 rounded-lg outline-none focus:border-[#3BB578] text-[#2B2B2B]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomPayerEmail(false);
                          setCustomPayerEmail("");
                        }}
                        className="px-2 py-1 text-[10px] text-neutral-500 hover:text-neutral-700 font-semibold"
                      >
                        Quitar
                      </button>
                    </div>
                    <p className="text-[9.5px] text-neutral-400">
                      Evita el error de Mercado Pago si tu cuenta personal usa otro correo diferente al de HABA.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <span className="text-[11px] text-[#7A7A7A]">¿Ya pagaste tu suscripción?</span>
                <button
                  type="button"
                  onClick={() => handleSyncMercadoPago(false)}
                  disabled={syncingMP}
                  className="text-[11px] font-bold text-[#1F7A4C] hover:text-[#185E3B] inline-flex items-center gap-1.5 px-2 py-1 hover:bg-[#DCF4D7]/50 rounded-lg transition active:scale-95 disabled:opacity-75"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingMP ? "animate-spin" : ""}`} />
                  <span>{syncingMP ? "Verificando..." : "Actualizar mi plan"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tarjeta Destacada: Contactar a soporte HABA */}
      {supportWhatsAppUrl && (
        <div className="bg-gradient-to-br from-[#F6FBF7] via-white to-[#EEF8F1] p-5 rounded-3xl border border-[#CDEBD3] shadow-sm space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#25D366]/15 text-[#128C7E] flex items-center justify-center flex-shrink-0 shadow-xs">
                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1F7A4C]">
                  Soporte y Asistencia
                </h3>
                <p className="text-sm font-bold text-neutral-800">
                  ¿Necesitás ayuda con tu cuenta?
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-[#DCF4D7] text-[#1F7A4C] px-2.5 py-0.5 rounded-full border border-[#C3EBC0]">
              Canal Directo
            </span>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            Escribile directamente a Gio para resolver consultas sobre el uso de HABA, dudas con tu suscripción o solicitar la baja de tu cuenta.
          </p>

          <a
            href={supportWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-soporte-whatsapp-perfil"
            className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
          >
            <WhatsAppIcon className="w-4 h-4 text-white" />
            <span>Contactar a soporte HABA</span>
          </a>
        </div>
      )}

      {isTermsEnabled() && (
        <a
          href="/terminos"
          target="_blank"
          rel="noopener noreferrer"
          id="link-terminos-perfil"
          className="block text-center text-xs font-semibold text-[#1F7A4C] underline underline-offset-2 hover:text-[#3BB578]"
        >
          Ver bases y condiciones
        </a>
      )}

      {/* Formulario de Emprendimiento */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3.5">
          Datos de tu Negocio
        </h3>
        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Número de cuenta HABA (Inmutable / Read-only) */}
          <div className="p-3.5 bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#3BB578]" />
                Número de cuenta HABA
              </label>
              <span className="text-[9.5px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                ID Único Inalterable
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={accountNumber || "Cargando..."}
                className="flex-1 px-3.5 py-2 text-sm font-mono font-bold text-[#1F7A4C] bg-white border border-neutral-200 rounded-xl outline-none select-all cursor-default"
              />
              <button
                type="button"
                onClick={handleCopyAccountNumber}
                disabled={!accountNumber}
                title="Copiar número de cuenta"
                className="px-3 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
              >
                {copiedAccountNum ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#3BB578]" />
                    <span className="text-[#1F7A4C] font-bold">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10.5px] text-neutral-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-neutral-400 flex-shrink-0" />
              Identificador administrativo único e inalterable.
            </p>
          </div>

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
              <Sparkles className="w-3.5 h-3.5 text-[#3BB578]" />
              Rubro o Especialidad del Emprendimiento
            </label>
            <input
              type="text"
              value={businessRubro}
              onChange={(e) => setBusinessRubro(e.target.value)}
              placeholder="Ej: Cerámica Artesanal, Confección Textil, Papelería..."
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
            />
            <p className="text-[10px] text-neutral-400">
              Se mostrará como subtítulo en el encabezado de tus presupuestos.
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

          {/* Datos de Contacto del Emprendimiento (Para Presupuestos y PDF) */}
          <div className="pt-3 border-t border-neutral-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F7A4C] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#3BB578]" />
                Datos de Contacto Comercial
              </span>
              <span className="text-[9.5px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                Presupuestos & PDF
              </span>
            </div>
            <p className="text-[10.5px] text-neutral-500">
              Estos datos se usarán en la carátula de presupuestos, la descarga en PDF y el mensaje enviado por WhatsApp.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#3BB578]" />
                  Teléfono / WhatsApp Comercial
                </label>
                <input
                  type="text"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="Ej: +54 9 11 1234-5678"
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#3BB578]" />
                  Email Comercial de Contacto
                </label>
                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="Ej: ventas@taller.com (opcional)"
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-[#3BB578]" />
                  Instagram / Red Social
                </label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Ej: @amaoto.craft"
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#3BB578]" />
                  Ubicación o Dirección del Taller
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Palermo, CABA / Buenos Aires"
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
                />
              </div>
            </div>

            {/* Selector de Color de Presupuesto */}
            <div className="pt-3 border-t border-neutral-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#3BB578]" />
                  Color Principal del Presupuesto (PDF)
                </span>
                <span className="text-[9.5px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                  Identidad Visual
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Seleccioná una sugerencia rápida o definí el código hexadecimal de tu propia marca para aplicarlo en los presupuestos.
              </p>

              {/* Sugerencias Rápidas */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                  Sugerencias Rápidas
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {QUOTE_COLOR_PALETTES.map((palette) => {
                    const isSelected =
                      !isCustomQuoteActive &&
                      (quoteColor.toLowerCase() === palette.id.toLowerCase() ||
                        quoteColor.toLowerCase() === palette.primary.toLowerCase());
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => handleSelectPreset(palette)}
                        className={`p-2.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                          isSelected
                            ? "border-neutral-900 bg-neutral-50 shadow-xs ring-2 ring-neutral-900/10"
                            : "border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="w-5 h-5 rounded-full shadow-2xs border border-white"
                            style={{ backgroundColor: palette.primary }}
                          />
                          {isSelected && <Check className="w-3.5 h-3.5 text-neutral-800" />}
                        </div>
                        <span className="text-[10.5px] font-bold text-neutral-800 leading-tight">
                          {palette.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tarjeta de Color Personalizado Libre */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCustomQuoteActive
                    ? "border-neutral-900 bg-neutral-50/70 shadow-xs ring-2 ring-neutral-900/10"
                    : "border-neutral-200 bg-white hover:bg-neutral-50/50 hover:border-neutral-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Selector interactivo y datos del color */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Botón interactivo con picker nativo integrado */}
                    <div className="relative group flex-shrink-0">
                      <div
                        className="w-11 h-11 rounded-2xl border-2 border-white shadow-sm flex items-center justify-center transition-transform group-hover:scale-105 cursor-pointer relative overflow-hidden"
                        style={{ backgroundColor: activeQuoteHex }}
                        title="Hacé clic para abrir el selector de colores interactivo"
                      >
                        <Pipette className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] pointer-events-none" />
                        <input
                          type="color"
                          value={activeQuoteHex}
                          onChange={handleColorPickerChange}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          aria-label="Elegir color personalizado en selector interactivo"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-neutral-800">
                          Color Personalizado Libre
                        </span>
                        {isCustomQuoteActive ? (
                          <span className="text-[9.5px] font-extrabold text-neutral-900 bg-white border border-neutral-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                            <Check className="w-3 h-3 text-[#3BB578]" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="text-[9.5px] text-neutral-400 font-medium">
                            (Elegí en el selector o escribí tu HEX)
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-neutral-500 pt-0.5">
                        Hacé clic en el círculo de color para abrir el selector interactivo o pegá tu código exacto de marca.
                      </p>
                    </div>
                  </div>

                  {/* Input de Código HEX y Muestra en Vivo */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    {/* Input manual de HEX */}
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-neutral-400 font-mono text-xs select-none">
                        #
                      </span>
                      <input
                        type="text"
                        value={customHexInput.startsWith("#") ? customHexInput.slice(1) : customHexInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                          handleHexInputChange({ target: { value: `#${val}` } } as any);
                        }}
                        onBlur={handleHexInputBlur}
                        placeholder="7C3AED"
                        maxLength={6}
                        className="w-28 pl-7 pr-2.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono font-bold text-neutral-800 uppercase focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 outline-none shadow-2xs transition"
                        title="Ingresá el código HEX de 6 caracteres (ej. 7C3AED)"
                      />
                    </div>

                    {/* Previsualización en Vivo de la Insignia */}
                    <div
                      className="px-3 py-2 rounded-xl border flex items-center gap-1.5 text-[11px] font-bold shadow-2xs transition-all flex-shrink-0"
                      style={{
                        backgroundColor: currentQuoteTheme.badgeBg,
                        borderColor: currentQuoteTheme.badgeBorder,
                        color: currentQuoteTheme.primaryDark || currentQuoteTheme.primary,
                      }}
                      title="Así se visualizarán las insignias y totales en tu presupuesto"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: activeQuoteHex }}
                      />
                      <span>Vista Previa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección Moneda y Formato Numérico por Usuaria (T4) */}
            <div className="pt-3 border-t border-neutral-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#3BB578]" />
                  Moneda y Formato Numérico
                </span>
                <span className="text-[9.5px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                  Internacional
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Elegí tu país para precargar moneda, separadores y decimales. Podés personalizar cada valor.
              </p>

              {/* Selector de País */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">
                  País / Región de Referencia
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition font-medium text-neutral-800"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.countryCode} value={c.countryCode}>
                      {c.flag} {c.countryName} ({c.currency} · {c.example})
                    </option>
                  ))}
                  <option value="custom">🌐 Otro / Personalizado</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                {/* Moneda */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Código de Moneda
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    placeholder="ARS, MXN, CLP, USD"
                    className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition uppercase font-mono font-bold text-neutral-800"
                  />
                </div>

                {/* Locale Numérico */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Separador Numérico
                  </label>
                  <select
                    value={numberLocale}
                    onChange={(e) => setNumberLocale(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition text-neutral-800"
                  >
                    <option value="es-AR">es-AR (Coma: 1.234,50)</option>
                    <option value="es-MX">es-MX (Punto: 1,234.50)</option>
                    <option value="es-CL">es-CL (Punto miles: 1.235)</option>
                    <option value="en-US">en-US (Punto: 1,234.50)</option>
                    <option value="es-CO">es-CO (Punto miles: 1.235)</option>
                    <option value="es-UY">es-UY (Coma: 1.234,50)</option>
                    <option value="es-ES">es-ES (Coma: 1.234,50)</option>
                    <option value="es-PE">es-PE (Punto: 1,234.50)</option>
                  </select>
                </div>

                {/* Decimales */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Decimales en Precios
                  </label>
                  <select
                    value={decimals}
                    onChange={(e) => setDecimals(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition font-semibold text-neutral-800"
                  >
                    <option value={2}>2 decimales (estándar)</option>
                    <option value={0}>Sin decimales (ej. Chile)</option>
                  </select>
                </div>
              </div>

              {/* Muestra en vivo */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Previsualización del formato:</span>
                <span className="font-bold text-[#1F7A4C] text-sm bg-white px-3 py-1 rounded-xl border border-neutral-200 shadow-2xs font-mono">
                  {formatMoney(1234.5, { currency, numberLocale, decimals })}
                </span>
              </div>
            </div>
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

      {/* Tarjeta: Objetivo Mensual & Sueldo Pretendido (Punto 4) */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Mano de Obra
              </h3>
              <p className="text-sm font-bold text-[#2B2B2B] font-display">
                Sueldo Pretendido & Costo por Hora
              </p>
            </div>
          </div>
          <Link
            href="/gastos"
            className="text-[11px] font-bold text-[#3BB578] hover:text-[#2E9E65] underline"
          >
            Ver Gastos Fijos →
          </Link>
        </div>

        <p className="text-xs text-neutral-500 leading-snug">
          Indicá cuánto querés ganar por mes y tu jornada habitual. HABA sumará tus gastos operativos y tu sueldo para calcular automáticamente el valor de tu hora y minuto de trabajo.
        </p>

        {laborError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{laborError}</span>
          </div>
        )}

        <form onSubmit={handleSaveLabor} className="space-y-3.5">
          {/* Sueldo Pretendido Mensual */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
              <span>Sueldo Pretendido Mensual ($)</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 font-bold text-xs">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={salary !== "" && salary !== null && salary !== undefined ? formatThousands(salary) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setSalary(raw ? parseInt(raw, 10) : "");
                }}
                placeholder="0"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
            <p className="text-[10px] text-neutral-400">
              Lo que querés ganar de bolsillo por mes trabajando en tus creaciones.
            </p>
          </div>

          {/* Días al mes y Horas por día */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">
                Días al mes
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={daysPerMonth === 0 ? "" : daysPerMonth}
                onChange={(e) => setDaysPerMonth(e.target.value)}
                placeholder="20"
                required
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none text-neutral-800 text-center font-bold"
              />
              <span className="text-[10px] text-neutral-400 block text-center">Habitual: 20 a 24 días</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">
                Horas por día
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={hoursPerDay === 0 ? "" : hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
                placeholder="6"
                required
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none text-neutral-800 text-center font-bold"
              />
              <span className="text-[10px] text-neutral-400 block text-center">Habitual: 4 a 8 hs</span>
            </div>
          </div>

          {/* Tarjeta de Resumen en Tiempo Real */}
          <div className="bg-[#DCF4D7]/70 border border-[#C3EBC0] rounded-2xl p-3.5 space-y-2 text-xs text-[#1F7A4C]">
            <div className="flex items-center justify-between text-[11px]">
              <span>Gastos Fijos ({formatMoney(fixedExpensesTotal)}) + Sueldo ({formatMoney(parsedSalary)}):</span>
            </div>
            <div className="flex items-center justify-between font-bold pt-1 border-t border-[#C3EBC0]">
              <span>Objetivo Mensual Unificado:</span>
              <span className="text-sm font-black text-[#1F7A4C]">{formatMoney(objetivoMensual)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#C3EBC0] text-center">
              <div className="bg-white/80 p-2 rounded-xl border border-[#C3EBC0]/60">
                <span className="text-[9.5px] text-neutral-500 block font-semibold">Valor por Hora</span>
                <span className="text-xs font-bold text-[#1F7A4C]">{formatMoney(calculatedHourlyRate)}/h</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-[#C3EBC0]/60">
                <span className="text-[9.5px] text-neutral-500 block font-semibold">Valor por Minuto</span>
                <span className="text-xs font-bold text-[#1F7A4C]">{formatMoney(calculatedMinuteRate)}/min</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingLabor}
            className="w-full py-2.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white font-semibold rounded-2xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-sm"
          >
            {savingLabor ? (
              <span>Guardando sueldo...</span>
            ) : laborSavedSuccess ? (
              <span className="flex items-center gap-1 text-white">
                <Check className="w-4 h-4" /> ¡Sueldo y horas actualizados!
              </span>
            ) : (
              <span>Guardar Sueldo y Horas</span>
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
