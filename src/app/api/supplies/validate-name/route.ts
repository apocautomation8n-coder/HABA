import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { normalizeSupplyName } from "@/lib/supplies";

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
    const { name, excludeSupplyId } = body;

    const normalizedName = normalizeSupplyName(name);

    if (!normalizedName) {
      return NextResponse.json(
        { error: "El nombre del insumo es obligatorio" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("supplies")
      .select("id, name")
      .eq("user_id", user.id)
      .ilike("name", normalizedName);

    if (excludeSupplyId && typeof excludeSupplyId === "string") {
      query = query.neq("id", excludeSupplyId);
    }

    const { data: existingSupplies, error: queryError } = await query;

    if (queryError) {
      console.error("Error al consultar insumos por nombre:", queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const isDuplicate = (existingSupplies || []).some(
      (s) => normalizeSupplyName(s.name) === normalizedName
    );

    if (isDuplicate) {
      return NextResponse.json(
        {
          isDuplicate: true,
          error: "Ya existe un insumo con este nombre. Elegí un nombre diferente.",
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
    console.error("Error en validate-name route para insumos:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
