import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { buildInitialUserMetadata, splitPlanMetadata } from "@/lib/plan-helpers";
import { TERMS_VERSION, isTermsEnabled } from "@/lib/terms";
import { getNextGlobalAccountNumber } from "@/lib/account";

/**
 * Registro público de usuarias (T5).
 *
 * Se hace en el servidor para que los datos del plan (prueba de 15 días, estado de cuenta)
 * se escriban en app_metadata, que la usuaria no puede modificar. Lo que envía el navegador
 * se trata solo como datos de contacto.
 */

const MIN_FORM_TIME_MS = 1200;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const attempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  // Evita que el mapa crezca indefinidamente
  if (attempts.size > 5000) attempts.clear();
  return false;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "El registro no está disponible por el momento." }, { status: 503 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Probá de nuevo en un rato." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Anti-bots: campo señuelo y tiempo mínimo en pantalla. Se simula éxito sin crear nada.
    if (clean(body.honeypot, 200) !== "") {
      return NextResponse.json({ success: true, requiresEmailConfirmation: true });
    }
    if (typeof body.elapsedMs === "number" && body.elapsedMs < MIN_FORM_TIME_MS) {
      return NextResponse.json(
        { error: "Por favor completá el formulario de forma manual." },
        { status: 400 }
      );
    }

    const fullName = clean(body.fullName, 120);
    const businessName = clean(body.businessName, 120);
    const phone = clean(body.phone, 40);
    const email = clean(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!fullName) {
      return NextResponse.json({ error: "Por favor ingresá tu nombre y apellido." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Por favor ingresá un correo electrónico válido." }, { status: 400 });
    }
    if (password.length < 6 || password.length > 200) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    if (isTermsEnabled() && body.acceptedTerms !== true) {
      return NextResponse.json(
        { error: "Es obligatorio leer y aceptar las Bases y Condiciones para registrarte." },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || new URL(request.url).origin;

    // Metadata de contacto (editable por la usuaria) y metadata del plan (solo servidor)
    const planMeta = buildInitialUserMetadata({
      planType: "prueba",
      isNew: true,
      registrationSource: "public",
      termsVersion: isTermsEnabled() ? TERMS_VERSION : null,
      termsAcceptedAt: isTermsEnabled() ? new Date().toISOString() : null,
    });
    const { app: appMetadata, user: planUserMetadata } = splitPlanMetadata(planMeta);

    const admin = createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const nextAccountNumber = await getNextGlobalAccountNumber(admin);

    const anon = createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          business_name: businessName || fullName,
          phone: phone || null,
          business_phone: phone || null,
          account_number: nextAccountNumber,
          ...planUserMetadata,
        },
        emailRedirectTo: `${origin}/dashboard`,
      },
    });

    const duplicateMessage =
      "Ya existe una cuenta registrada con este correo electrónico. Si es tuya, podés iniciar sesión o restablecer tu contraseña.";

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already in use") ||
        msg.includes("user already exists") ||
        error.status === 422
      ) {
        return NextResponse.json({ error: duplicateMessage }, { status: 409 });
      }

      // Si Supabase excedió el límite horario de envíos de email de prueba ("email rate limit exceeded")
      // crear la usuaria de forma directa confirmada para no bloquear su registro ni su prueba de 15 días
      if (msg.includes("rate limit") || msg.includes("email rate limit")) {
        console.warn("[Registro] Límite de emails de Supabase alcanzado. Creando usuaria directamente con service_role...");
        const { data: adminCreated, error: adminErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            business_name: businessName || fullName,
            phone: phone || null,
            business_phone: phone || null,
            account_number: nextAccountNumber,
            ...planUserMetadata,
          },
          app_metadata: {
            ...appMetadata,
            account_number: nextAccountNumber,
          },
        });

        if (adminErr) {
          const adminMsg = adminErr.message.toLowerCase();
          if (adminMsg.includes("already registered") || adminMsg.includes("user already exists")) {
            return NextResponse.json({ error: duplicateMessage }, { status: 409 });
          }
          return NextResponse.json({ error: adminErr.message || "Error al registrar usuaria." }, { status: 400 });
        }

        // Crear registro en profiles
        try {
          await admin.from("profiles").upsert({
            id: adminCreated.user.id,
            email,
            full_name: fullName,
            business_name: businessName || fullName,
            phone: phone || null,
            account_number: nextAccountNumber,
            role: "user",
            status: "active",
            updated_at: new Date().toISOString(),
          });
        } catch {
          // ignore
        }

        return NextResponse.json({
          success: true,
          requiresEmailConfirmation: false,
        });
      }

      return NextResponse.json({ error: error.message || "No se pudo completar el registro." }, { status: 400 });
    }

    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json({ error: duplicateMessage }, { status: 409 });
    }

    if (data?.user) {
      const { error: planError } = await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: {
          ...appMetadata,
          account_number: nextAccountNumber,
        },
        user_metadata: {
          ...(data.user.user_metadata || {}),
          account_number: nextAccountNumber,
        },
      });
      if (planError) {
        // Sin app_metadata la cuenta igualmente recibe la prueba de 15 días desde su fecha de creación
        console.error("[Registro] No se pudo guardar el plan en app_metadata:", planError.message);
      }
    }

    return NextResponse.json({
      success: true,
      requiresEmailConfirmation: !data?.session,
    });
  } catch (err: any) {
    console.error("[Registro] Error inesperado:", err);
    return NextResponse.json({ error: "Ocurrió un error inesperado al procesar el registro." }, { status: 500 });
  }
}
