import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPlanExpired, getTrustedPlanMeta } from "@/lib/plan-helpers";
import { checkIsAdmin } from "@/lib/auth-helpers";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/registro");
  const isPublicPage = pathname.startsWith("/terminos");
  const isExpiredPage = pathname.startsWith("/plan-vencido");
  const isPublicStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico";

  // Si es un recurso estático o API, no interferir con la sesión
  if (isPublicStatic || isPublicPage) {
    return supabaseResponse;
  }

  // Si está en /login o /registro y no tiene cookies de sesión, retornar inmediatamente sin hacer llamada de red
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
  if (isAuthPage && !hasAuthCookie) {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (!error && authUser) {
      user = authUser;
    }
  } catch (err: any) {
    // Evitar que una cancelación de conexión en Edge Runtime rompa la respuesta
    console.warn("[Middleware] Advertencia de autenticación:", err?.message || err);
  }

  // Si no hay usuario e intenta acceder a ruta protegida (o /plan-vencido sin sesión), redirigir a /login
  if (!user && !isAuthPage && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // Si hay usuario autenticado:
  if (user) {
    const isAdmin = checkIsAdmin(user);

    // 1. La administradora Gio nunca se bloquea
    if (isAdmin) {
      if (isAuthPage || isExpiredPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return redirectResponse;
      }
      return supabaseResponse;
    }

    // Si la usuaria no es admin (Gio) e intenta acceder a la ruta de administración (/admin), redirigir a /dashboard
    if (!isAdmin && pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    // 2. Control de expiración para usuarias regulares (T6)
    const trustedPlan = getTrustedPlanMeta(user);
    const hasExpired = isPlanExpired(trustedPlan.plan_end_date, trustedPlan.account_status);

    if (hasExpired) {
      // Si el plan venció y no está en /plan-vencido, redirigir forzosamente a la pantalla de bloqueo
      if (!isExpiredPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/plan-vencido";
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return redirectResponse;
      }
    } else {
      // Si el plan está vigente pero intenta entrar a /login, /registro o /plan-vencido, enviar a /dashboard
      // Nota: Si incluye ?test=true o retorno de Mercado Pago en /plan-vencido, permitir para verificar el pago
      const hasPaymentParams =
        request.nextUrl.searchParams.has("status") ||
        request.nextUrl.searchParams.has("preapproval_id") ||
        request.nextUrl.searchParams.has("payment_id") ||
        request.nextUrl.searchParams.has("collection_id") ||
        request.nextUrl.searchParams.get("test") === "true";

      const isTestingOrReturning = isExpiredPage && hasPaymentParams;

      if ((isAuthPage || isExpiredPage) && !isTestingOrReturning) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return redirectResponse;
      }
    }
  }

  return supabaseResponse;
}
