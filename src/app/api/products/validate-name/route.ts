import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, excludeProductId } = body;

    const normalizedName = typeof name === "string" ? name.trim().toLowerCase() : "";

    if (!normalizedName) {
      return NextResponse.json(
        { error: "El nombre del producto es obligatorio" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("products")
      .select("id, name")
      .eq("user_id", user.id)
      .ilike("name", normalizedName);

    if (excludeProductId && typeof excludeProductId === "string") {
      query = query.neq("id", excludeProductId);
    }

    const { data: existingProducts, error: queryError } = await query;

    if (queryError) {
      console.error("Error al consultar productos por nombre:", queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const isDuplicate = (existingProducts || []).some(
      (p) => p.name.trim().toLowerCase() === normalizedName
    );

    if (isDuplicate) {
      return NextResponse.json(
        {
          isDuplicate: true,
          error: "Ya existe un producto con ese nombre",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        isDuplicate: false,
        message: "Nombre disponible",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error en validate-name route:", err);
    return NextResponse.json({ error: err.message || "Error interno del servidor" }, { status: 500 });
  }
}
