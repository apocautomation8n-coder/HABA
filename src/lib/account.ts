/**
 * Utilidades para el Identificador Interno Administrativo (ID de Usuario / Número de Cuenta HABA)
 * Estándar: "01", "02", "03", etc. (secuencial con padding de al menos 2 dígitos)
 */

export const ACCOUNT_NUMBER_START = 1;

/**
 * Formatea un número secuencial en el estándar de dos dígitos (ej: 1 -> "01", 2 -> "02", ..., 10 -> "10")
 */
export function formatAccountNumber(sequenceNumber: number): string {
  const num = Math.max(1, Math.floor(sequenceNumber));
  return String(num).padStart(2, "0");
}

/**
 * Valida si un string cumple con el formato de ID de usuario
 */
export function isValidAccountNumber(accountNumber: string | null | undefined): boolean {
  if (!accountNumber) return false;
  const trimmed = accountNumber.trim();
  return /^\d{2,}$/.test(trimmed) || /^HABA-\d+$/i.test(trimmed);
}

/**
 * Extrae el número secuencial de un ID / número de cuenta
 * Ejemplo: "01" -> 1, "02" -> 2, "HABA-001001" -> 1001, "1" -> 1
 */
export function parseAccountNumber(accountNumber: string | null | undefined): number | null {
  if (!accountNumber) return null;
  const cleaned = accountNumber.trim().replace(/^HABA-/i, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Genera el siguiente número de cuenta en base a la lista de usuarios/perfiles existentes.
 * Evita condiciones de carrera buscando el máximo ID existente (< 1000 para ignorar valores anómalos previos) y sumando 1.
 */
export function getNextAccountNumberFromList(
  existingAccounts: Array<{ account_number?: string | null; email?: string; role?: string; created_at?: string }>
): string {
  let maxSeq = 0;

  for (const item of existingAccounts) {
    if (item.account_number) {
      const seq = parseAccountNumber(item.account_number);
      // Ignoramos secuencias >= 1000 que hayan quedado del bug previo HABA-001001
      if (seq !== null && seq > maxSeq && seq < 1000) {
        maxSeq = seq;
      }
    }
  }

  // Si no había ningún número previo asignado pero hay cuentas registradas
  if (maxSeq === 0) {
    const count = existingAccounts.length;
    return formatAccountNumber(Math.max(1, count + 1));
  }

  return formatAccountNumber(maxSeq + 1);
}
