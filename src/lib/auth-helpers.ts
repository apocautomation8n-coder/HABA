export interface SimpleUser {
  id?: string;
  email?: string | null;
  user_metadata?: {
    role?: string;
    full_name?: string;
    business_name?: string;
    [key: string]: any;
  } | null;
}

export interface SimpleProfile {
  id?: string;
  role?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  status?: string | null;
  email?: string | null;
}

export const ADMIN_EMAILS = [
  "admin@admin.com",
  "gio@amaoto.com",
];

export function isGioEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAILS.includes(normalized)) return true;
  const envAdmin = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (envAdmin && normalized === envAdmin.trim().toLowerCase()) return true;
  return false;
}

/**
 * Robust check for admin privileges.
 * Regla de negocio estricta: Únicamente la administradora Gio tiene acceso al panel de administración.
 * Ninguna otra cuenta o usuaria regular puede ver la pestaña de Admin ni acceder a sus funciones.
 */
export function checkIsAdmin(
  user: SimpleUser | null | undefined,
  profileRole?: string | null
): boolean {
  if (!user && !profileRole) return false;

  // 1. Si tenemos el objeto usuario con email, validar estrictamente que sea Gio
  if (user?.email) {
    return isGioEmail(user.email);
  }

  // 2. Si solo tenemos profileRole sin usuario con email
  if (profileRole === "admin") {
    return true;
  }

  return false;
}

/**
 * Returns a friendly name for greeting and headers
 */
export function getUserDisplayName(
  user: SimpleUser | null | undefined,
  profile?: SimpleProfile | null
): string {
  if (profile?.full_name?.trim()) {
    return profile.full_name.trim();
  }
  if (user?.user_metadata?.full_name?.trim()) {
    return user.user_metadata.full_name.trim();
  }
  if (profile?.business_name?.trim()) {
    return profile.business_name.trim();
  }
  if (user?.user_metadata?.business_name?.trim()) {
    return user.user_metadata.business_name.trim();
  }
  if (user?.email) {
    return user.email.split("@")[0];
  }
  return "Emprendedora";
}
