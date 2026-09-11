import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkIsAdmin } from "@/lib/auth-helpers";

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

async function verifyAdminCaller(request: Request) {
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
      return {
        authorized: false as const,
        response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
      };
    }

    if (!checkIsAdmin(user)) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { error: "Acceso denegado: solo administradora (Gio)" },
          { status: 403 }
        ),
      };
    }

    return { authorized: true as const, user };
  } catch (err: any) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Error de autenticación: " + err.message }, { status: 500 }),
    };
  }
}

// GET: Listar todas las usuarias del sistema
export async function GET(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ users: profiles || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Alta de nueva usuaria
export async function POST(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const { email, password, fullName, businessName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // 1. Crear usuario en Auth con confirmación automática
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName?.trim() || null,
          business_name: businessName?.trim() || null,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario en Auth" },
        { status: 400 }
      );
    }

    // 2. Insertar o actualizar su perfil en public.profiles
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: authData.user.id,
      email: email.trim().toLowerCase(),
      full_name: fullName?.trim() || null,
      business_name: businessName?.trim() || null,
      role: "user",
      status: "active",
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Cambiar estado (active / suspended) o actualizar datos
export async function PATCH(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const { userId, status, password } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    // Si se pasa nuevo status
    if (status) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    // Si se pasa nueva contraseña
    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Eliminar usuaria definitivamente
export async function DELETE(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    // 1. Borrar perfil en profiles
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 2. Borrar de auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
