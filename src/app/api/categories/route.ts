import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PRODUCT_CATEGORIES, parseProductMeta } from "@/lib/products";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Extraer categorías dinámicas a partir de los productos del usuario
    const { data: userProducts, error } = await supabase
      .from("products")
      .select("description")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const categoriesMap = new Map<string, { id: string; label: string; icon: string; count: number }>();

    // Inicializar presets
    for (const preset of PRODUCT_CATEGORIES) {
      categoriesMap.set(preset.label.toLowerCase(), {
        id: preset.id,
        label: preset.label,
        icon: preset.icon,
        count: 0,
      });
    }

    // Contar productos y descubrir categorías personalizadas
    for (const prod of userProducts || []) {
      const meta = parseProductMeta(prod.description);
      const key = meta.category.trim().toLowerCase();
      if (categoriesMap.has(key)) {
        categoriesMap.get(key)!.count++;
      } else {
        categoriesMap.set(key, {
          id: `custom-${key.replace(/[^a-z0-9]+/g, "-")}`,
          label: meta.category.trim(),
          icon: meta.categoryIcon || "🏷️",
          count: 1,
        });
      }
    }

    return NextResponse.json({
      categories: Array.from(categoriesMap.values()),
    });
  } catch (err: any) {
    console.error("Error en GET /api/categories:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
