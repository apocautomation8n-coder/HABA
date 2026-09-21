/**
 * Utilidades para el Identificador Interno Administrativo (Número de Cuenta HABA)
 */

export const ACCOUNT_NUMBER_PREFIX = "HABA-";
export const ACCOUNT_NUMBER_START = 1001;

/**
 * Formatea un número secuencial en el estándar HABA-XXXXXX
 * Ejemplo: 1001 -> "HABA-001001"
 */
export function formatAccountNumber(sequenceNumber: number): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `${ACCOUNT_NUMBER_PREFIX}${padded}`;
}

/**
 * Valida si un string cumple con el formato oficial de número de cuenta HABA
 */
export function isValidAccountNumber(accountNumber: string | null | undefined): boolean {
  if (!accountNumber) return false;
  return /^HABA-\d{6}$/.test(accountNumber.trim());
}

/**
 * Extrae el número secuencial de un número de cuenta
 * Ejemplo: "HABA-001042" -> 1042
 */
export function parseAccountNumber(accountNumber: string | null | undefined): number | null {
  if (!accountNumber || !isValidAccountNumber(accountNumber)) return null;
  const numPart = accountNumber.trim().replace(ACCOUNT_NUMBER_PREFIX, "");
  const parsed = parseInt(numPart, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Genera el siguiente número de cuenta en base a la lista de usuarios/perfiles existentes
 */
export function getNextAccountNumberFromList(
  existingAccounts: Array<{ account_number?: string | null; created_at?: string }>
): string {
  let maxSeq = ACCOUNT_NUMBER_START - 1;

  for (const item of existingAccounts) {
    if (item.account_number) {
      const seq = parseAccountNumber(item.account_number);
      if (seq !== null && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  // Si no había ningún número previo asignado pero hay N cuentas, calculamos acorde al tamaño
  if (maxSeq < ACCOUNT_NUMBER_START) {
    const count = existingAccounts.length;
    return formatAccountNumber(ACCOUNT_NUMBER_START + count);
  }

  return formatAccountNumber(maxSeq + 1);
}
