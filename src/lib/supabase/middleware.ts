import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPlanExpired } from "@/lib/plan-helpers";

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
    const isAdmin =
      user.email?.toLowerCase() === "admin@admin.com" ||
      user.user_metadata?.role === "admin";

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

    // 2. Control de expiración para usuarias regulares (T6)
    const planEndDate = user.user_metadata?.plan_end_date;
    const accountStatus = user.user_metadata?.account_status;
    const hasExpired = isPlanExpired(planEndDate, accountStatus);

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
      if (isAuthPage || isExpiredPage) {
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
