import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Endpoint de backend con service role para altas y bajas administrativas por Gio
export async function POST(request: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

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
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          business_name: businessName,
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
      email: email,
      full_name: fullName || null,
      business_name: businessName || null,
      role: "user",
      is_active: true,
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

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    // Borrar de auth.users (en cascada limpia perfiles y registros de BD)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
