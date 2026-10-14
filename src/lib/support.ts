/**
 * Utilidades para Soporte HABA vía WhatsApp
 */

export function getSupportWhatsAppNumber(): string {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";
  // Limpia cualquier signo, espacio o caracter que no sea dígito
  return raw.replace(/[^0-9]/g, "");
}

export function isSupportWhatsAppConfigured(): boolean {
  return getSupportWhatsAppNumber().length > 0;
}

export interface SupportProfileData {
  accountNumber?: string | null;
  businessName?: string | null;
  fullName?: string | null;
}

export interface SupportLoginData {
  email?: string | null;
}

/**
 * Genera el enlace de WhatsApp para el Perfil / Configuración
 * Plantilla: "Hola soporte HABA, me comunico desde la cuenta #{account_number} ({nombre_emprendimiento}). Necesito ayuda con..."
 */
export function buildProfileSupportWhatsAppUrl(data?: SupportProfileData): string | null {
  const phone = getSupportWhatsAppNumber();
  if (!phone) return null;

  const accountNum = data?.accountNumber?.trim();
  const name = data?.businessName?.trim() || data?.fullName?.trim();

  let cuentaIdentificador = "";
  if (accountNum && name) {
    cuentaIdentificador = `la cuenta #${accountNum} (${name})`;
  } else if (accountNum) {
    cuentaIdentificador = `la cuenta #${accountNum}`;
  } else if (name) {
    cuentaIdentificador = `mi cuenta (${name})`;
  } else {
    cuentaIdentificador = "mi cuenta";
  }

  const message = `Hola soporte HABA, me comunico desde ${cuentaIdentificador}. Necesito ayuda con...`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera el enlace de WhatsApp para la Pantalla de Login / Acceso
 * Plantilla: "Hola soporte HABA, tengo problemas para ingresar a mi cuenta. Mi correo es: "
 */
export function buildLoginSupportWhatsAppUrl(data?: SupportLoginData): string | null {
  const phone = getSupportWhatsAppNumber();
  if (!phone) return null;

  const emailPart = data?.email && data.email.trim() ? ` ${data.email.trim()}` : " ";
  const message = `Hola soporte HABA, tengo problemas para ingresar a mi cuenta. Mi correo es:${emailPart}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Función general retrocompatible
 */
export function buildSupportWhatsAppUrl(options?: {
  accountNumber?: string | null;
  businessName?: string | null;
  fullName?: string | null;
  email?: string | null;
  customMessage?: string;
  context?: "profile" | "login";
}): string | null {
  const phone = getSupportWhatsAppNumber();
  if (!phone) return null;

  if (options?.customMessage) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(options.customMessage)}`;
  }

  if (options?.context === "login") {
    return buildLoginSupportWhatsAppUrl({ email: options.email });
  }

  if (
    options?.context === "profile" ||
    options?.accountNumber ||
    options?.businessName ||
    options?.fullName
  ) {
    return buildProfileSupportWhatsAppUrl({
      accountNumber: options?.accountNumber,
      businessName: options?.businessName,
      fullName: options?.fullName,
    });
  }

  return buildLoginSupportWhatsAppUrl({ email: options?.email });
}

