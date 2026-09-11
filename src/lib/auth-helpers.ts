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

/**
 * Robust check for admin privileges.
 * Checks email, user_metadata.role, and DB profile.role.
 * Avoids failing if Supabase profiles RLS is restricted or recursing.
 */
export function checkIsAdmin(
  user: SimpleUser | null | undefined,
  profileRole?: string | null
): boolean {
  if (!user && !profileRole) return false;

  const email = user?.email?.trim().toLowerCase();
  if (email === "admin@admin.com" || email === "gio@amaoto.com") {
    return true;
  }

  if (user?.user_metadata?.role === "admin") {
    return true;
  }

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
