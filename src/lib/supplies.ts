/**
 * Utilidades y servicios de validación y persistencia para Insumos (Supplies) de HABA.
 */

export interface SupplyLike {
  id?: string;
  name: string;
  category?: string;
  user_id?: string;
}

/**
 * Normaliza el nombre de un insumo eliminando espacios en los extremos y convirtiendo a minúsculas.
 */
export function normalizeSupplyName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase();
}

/**
 * Valida si un nombre de insumo ya existe en una lista de insumos en memoria,
 * ignorando mayúsculas/minúsculas y espacios innecesarios (trim).
 * Permite excluir un ID (útil en edición para no autodetectar colisión contra sí mismo).
 */
export function isDuplicateSupplyName(
  candidateName: string,
  existingSupplies: Array<{ id?: string; name: string }>,
  excludeSupplyId?: string
): boolean {
  const normalized = normalizeSupplyName(candidateName);
  if (!normalized) return false;

  return existingSupplies.some((s) => {
    if (!s || !s.name) return false;
    if (excludeSupplyId && s.id && s.id === excludeSupplyId) {
      return false;
    }
    return normalizeSupplyName(s.name) === normalized;
  });
}

/**
 * Consulta en Supabase si ya existe un insumo con el mismo nombre para el usuario actual.
 * Aplica ilike para búsqueda insensible a mayúsculas/minúsculas y filtra por user_id.
 */
export async function checkSupplyNameExists(
  supabase: any,
  name: string,
  excludeSupplyId?: string,
  userId?: string
): Promise<boolean> {
  const normalized = normalizeSupplyName(name);
  if (!normalized) return false;

  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    }

    if (!resolvedUserId) {
      console.warn("checkSupplyNameExists: No se pudo determinar el user_id.");
      return false;
    }

    let query = supabase
      .from("supplies")
      .select("id, name")
      .eq("user_id", resolvedUserId)
      .ilike("name", normalized);

    if (excludeSupplyId) {
      query = query.neq("id", excludeSupplyId);
    }

    const { data, error } = await query;
    if (error || !data) return false;

    return data.some(
      (s: any) => normalizeSupplyName(s.name) === normalized
    );
  } catch (err) {
    console.error("Error al consultar existencia de insumo por nombre:", err);
    return false;
  }
}
