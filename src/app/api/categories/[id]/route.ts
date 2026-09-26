import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { parseProductMeta, serializeProductDescription } from "@/lib/products";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { oldName, newName, icon } = body;

    const trimmedNew = typeof newName === "string" ? newName.trim() : "";
    const trimmedOld = typeof oldName === "string" ? oldName.trim() : "";

    if (!trimmedNew) {
      return NextResponse.json(
        { error: "El nuevo nombre de la categoría es obligatorio" },
        { status: 400 }
      );
    }

    // Target name to search: if oldName provided use it, otherwise use decoded id
    const targetOldName = trimmedOld || decodeURIComponent(id).trim();

    // Actualizar todos los productos del usuario que tengan esta categoría
    const { data: userProducts, error: fetchErr } = await supabase
      .from("products")
      .select("id, description")
      .eq("user_id", user.id);

    if (fetchErr) {
      console.error("Error al buscar productos para actualizar categoría:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    let updatedCount = 0;
    const normTarget = targetOldName.toLowerCase();

    for (const prod of userProducts || []) {
      const meta = parseProductMeta(prod.description);
      if (meta.category.trim().toLowerCase() === normTarget) {
        const updatedDescription = serializeProductDescription({
          cleanDescription: meta.cleanDescription,
          category: trimmedNew,
          isActive: meta.isActive,
          yieldValue: meta.yield,
        });

        const { error: updErr } = await supabase
          .from("products")
          .update({ description: updatedDescription })
          .eq("id", prod.id);

        if (!updErr) {
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Categoría renombrada a "${trimmedNew}" exitosamente`,
      updatedProductsCount: updatedCount,
      category: {
        id,
        label: trimmedNew,
        icon: icon || "🏷️",
      },
    });
  } catch (err: any) {
    console.error("Error en PATCH /api/categories/[id]:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let targetName = decodeURIComponent(id).trim();
    let reassignTo = "Otro";

    // Intentar leer body opcional si se envía
    try {
      const body = await request.json();
      if (body.name && typeof body.name === "string") {
        targetName = body.name.trim();
      }
      if (body.reassignTo && typeof body.reassignTo === "string") {
        reassignTo = body.reassignTo.trim() || "Otro";
      }
    } catch {
      // Body es opcional en DELETE
    }

    const { data: userProducts, error: fetchErr } = await supabase
      .from("products")
      .select("id, description")
      .eq("user_id", user.id);

    if (fetchErr) {
      console.error("Error al buscar productos para reasignar categoría:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    let affectedCount = 0;
    const normTarget = targetName.toLowerCase();

    for (const prod of userProducts || []) {
      const meta = parseProductMeta(prod.description);
      if (meta.category.trim().toLowerCase() === normTarget) {
        const updatedDescription = serializeProductDescription({
          cleanDescription: meta.cleanDescription,
          category: reassignTo,
          isActive: meta.isActive,
          yieldValue: meta.yield,
        });

        const { error: updErr } = await supabase
          .from("products")
          .update({ description: updatedDescription })
          .eq("id", prod.id);

        if (!updErr) {
          affectedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Categoría eliminada. ${affectedCount} productos reasignados a "${reassignTo}".`,
      affectedProductsCount: affectedCount,
      reassignedTo: reassignTo,
    });
  } catch (err: any) {
    console.error("Error en DELETE /api/categories/[id]:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
