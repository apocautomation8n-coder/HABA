import { useMemo, useState } from "react";

/**
 * Normaliza un texto eliminando acentos, caracteres diacríticos, pasando a minúsculas
 * y recortando espacios sobrantes.
 * Ej: "  Cartón Corrugado  " -> "carton corrugado"
 */
export function normalizeSearchText(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Comprueba si uno o varios campos contienen los términos buscados.
 * Es insensible a mayúsculas y acentos, y permite coincidencias de múltiples palabras
 * sin importar el orden o palabras intermedias (tokenización).
 *
 * Ej: matchesSearch([item.name, item.category], "caja kraft")
 * devolverá true si el texto combinado contiene tanto "caja" como "kraft".
 */
export function matchesSearch(
  targets: (string | number | null | undefined)[] | string | number | null | undefined,
  query: string
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const targetList = Array.isArray(targets) ? targets : [targets];
  const combined = targetList
    .map((t) => normalizeSearchText(t))
    .filter(Boolean)
    .join(" ");

  if (!combined) return false;

  // Cada palabra/token de la búsqueda debe estar presente en el contenido
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return queryTokens.every((token) => combined.includes(token));
}

/**
 * Hook reutilizable para manejar el estado de búsqueda y el filtrado memoizado.
 */
export function useSearch<T>(
  items: T[],
  extractFields: (item: T) => (string | number | null | undefined)[]
) {
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) => matchesSearch(extractFields(item), search));
  }, [items, search, extractFields]);

  const clearSearch = () => setSearch("");

  return {
    search,
    setSearch,
    clearSearch,
    filteredItems,
  };
}
