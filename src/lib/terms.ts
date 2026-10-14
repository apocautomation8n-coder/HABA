/**
 * Bases y condiciones de HABA.
 *
 * Cómo activarlas:
 *  1. Reemplazar TERMS_SECTIONS por el texto final que envíe Amaoto Craft.
 *  2. Asignar TERMS_VERSION (ej. "2026-10"). Mientras sea null, la página
 *     /terminos, los enlaces y el pedido de aceptación quedan desactivados.
 *  3. Para pedir una nueva aceptación tras un cambio de texto, subir la versión.
 *
 * La aceptación se guarda en user_metadata (terms_version, terms_accepted_at),
 * por lo que no requiere migraciones en la base de datos.
 */

export const TERMS_VERSION: string | null = null;

export const TERMS_LAST_UPDATED = "";

export interface TermsSection {
  title: string;
  paragraphs: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [];

export function isTermsEnabled(): boolean {
  return Boolean(TERMS_VERSION) && TERMS_SECTIONS.length > 0;
}

export function needsTermsAcceptance(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!isTermsEnabled()) return false;
  return metadata?.terms_version !== TERMS_VERSION;
}
