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

// POST: Subir foto de perfil o logo
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    // Fallback: Authorization header
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

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null || formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo de imagen" }, { status: 400 });
    }

    // Validar tipo de archivo
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];
    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no válido. Solo se admiten imágenes JPG, PNG, WebP, GIF o SVG" },
        { status: 400 }
      );
    }

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen supera el límite permitido de 5MB" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Determinar extensión
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;

    // Convertir a ArrayBuffer para subir
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a bucket 'avatars'
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Error al subir la imagen: " + uploadError.message }, { status: 500 });
    }

    // Obtener URL pública
    const { data: urlData } = admin.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl;

    // Actualizar en auth user_metadata
    const currentMetadata = user.user_metadata || {};
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...currentMetadata,
        avatar_url: avatarUrl,
      },
    });

    if (updateError) {
      return NextResponse.json({ error: "Error al guardar el avatar en el perfil: " + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Quitar foto de perfil o logo
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

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
    const currentMetadata = user.user_metadata || {};

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...currentMetadata,
        avatar_url: null,
      },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, avatarUrl: null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
