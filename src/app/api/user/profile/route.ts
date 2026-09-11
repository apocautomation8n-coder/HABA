import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// GET: Obtener perfil del usuario actual (bypasseando RLS para evitar recursión)
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: si viene Authorization header
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const admin = getAdminClient();
        const { data } = await admin.auth.getUser(token);
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdmin =
      user.email?.toLowerCase() === "admin@admin.com" ||
      user.user_metadata?.role === "admin" ||
      profile?.role === "admin";

    return NextResponse.json({
      user,
      profile: profile || {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        business_name: user.user_metadata?.business_name || null,
        role: isAdmin ? "admin" : "user",
        status: "active",
      },
      isAdmin,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Actualizar perfil del usuario actual
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerClient();
    let { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const admin = getAdminClient();
        const { data } = await admin.auth.getUser(token);
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, businessName, email, password } = body;

    const admin = getAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (fullName !== undefined) updateData.full_name = fullName?.trim() || null;
    if (businessName !== undefined) updateData.business_name = businessName?.trim() || null;

    const authUpdate: Record<string, any> = {
      user_metadata: {
        ...(user.user_metadata || {}),
        full_name: fullName !== undefined ? fullName.trim() : user.user_metadata?.full_name,
        business_name: businessName !== undefined ? businessName.trim() : user.user_metadata?.business_name,
      },
    };

    if (email && email.trim().toLowerCase() !== user.email?.toLowerCase()) {
      authUpdate.email = email.trim().toLowerCase();
      authUpdate.email_confirm = true;
      updateData.email = email.trim().toLowerCase();
    }

    if (password && password.trim().length >= 6) {
      authUpdate.password = password.trim();
    }

    // 1. Actualizar datos en Supabase Auth
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, authUpdate);
    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    // 2. Actualizar en profiles
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: user.id,
        email: updateData.email || user.email,
        ...updateData,
      });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
