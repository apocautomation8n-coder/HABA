/**
 * Controles contra cuentas falsas en el registro: correos descartables (temporales), dominios que
 * no reciben correo y el mismo correo usado varias veces con variantes (puntos o "+algo").
 */
import { promises as dns } from "dns";

/** Dominios de correo temporal o descartable más usados (se pueden sumar más con BLOCKED_EMAIL_DOMAINS). */
const DISPOSABLE_DOMAINS = new Set<string>([
  "necub.com", "drtall.com", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmail.dev",
  "tempmailo.com", "tempmail.plus", "tempail.com", "tempr.email", "tmpmail.org", "tmpmail.net", "tmail.ws",
  "10minutemail.com", "10minutemail.net", "10minemail.com", "20minutemail.com", "guerrillamail.com",
  "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamailblock.com", "sharklasers.com",
  "grr.la", "pokemail.net", "spam4.me", "mailinator.com", "mailinator.net", "mailinator2.com", "maildrop.cc",
  "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx",
  "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "getnada.com", "nada.email", "throwawaymail.com", "trashmail.com", "trashmail.net", "trashmail.de",
  "trashmail.me", "dispostable.com", "fakeinbox.com", "fakemail.net", "mintemail.com", "mohmal.com",
  "emailondeck.com", "mailnesia.com", "mailcatch.com", "mytemp.email", "inboxkitten.com", "burnermail.io",
  "spamgourmet.com", "spambox.us", "mailpoof.com", "dropmail.me", "emltmp.com", "moakt.com", "moakt.cc",
  "tempinbox.com", "mail.tm", "mail.gw", "cyclic.email", "1secmail.com", "1secmail.net", "1secmail.org",
  "esiix.com", "wwjmp.com", "xojxe.com", "yoggm.com", "kzccv.com", "qiott.com", "dcctb.com", "vjuum.com",
  "laafd.com", "txcct.com", "rteet.com", "dpptd.com", "fextemp.com", "tmails.net", "tmpbox.net",
  "minuteinbox.com", "emailfake.com", "email-fake.com", "fakemailgenerator.com", "generator.email",
  "luxusmail.org", "mailto.plus", "fexpost.com", "fexbox.org", "mailbox.in.ua", "rover.info", "chitthi.in",
  "inpwa.com", "any.pink", "merepost.com", "bugfoo.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us", "armyspy.com", "byom.de",
  "harakirimail.com", "hidemail.de", "incognitomail.org", "mailexpire.com", "mailforspam.com", "mailfreeonline.com",
  "mailmetrash.com", "mailscrap.com", "mailzilla.com", "meltmail.com", "mt2015.com", "mytrashmail.com",
  "nowmymail.com", "objectmail.com", "proxymail.eu", "rcpt.at", "safetymail.info", "sogetthis.com",
  "spamfree24.org", "spamherelots.com", "tempemail.net", "tempomail.fr", "temporaryemail.net",
  "temporaryinbox.com", "thankyou2010.com", "trash-mail.com", "trashymail.com", "wegwerfmail.de",
  "wegwerfmail.net", "wh4f.org", "zoemail.org", "discard.email", "discardmail.com", "anonbox.net",
  "boun.cr", "deadaddress.com", "e4ward.com", "gishpuppy.com", "kasmail.com", "letthemeatspam.com",
  "lroid.com", "mailnull.com", "nepwk.com", "owlpic.com", "spamex.com", "tempmailaddress.com",
  "tempmail.us.com", "temp-mail.us", "tempm.com", "tmpeml.com", "linshiyouxiang.net", "bccto.me",
  "chacuo.net", "027168.com", "smashmail.de", "zetmail.com", "vomoto.com", "ezztt.com", "lyricspad.net",
  "gufum.com", "bheps.com", "nqmo.com", "duck2.club", "tiktokng.com", "cevipsa.com", "lmaritimen.com",
]);

/**
 * Servidores de correo de servicios temporales. Estos servicios cambian de dominio todo el tiempo
 * (digeros.com, drtall.com...), pero reciben en los mismos servidores: se bloquea por servidor.
 */
const DISPOSABLE_MX_HOSTS = [
  "wabblywabble.com", "wallywatts.com", "necub.com", "yopmail.com", "mailinator.com", "guerrillamail.com",
  "sharklasers.com", "mail.tm", "mail.gw", "temp-mail.org", "tempmail.com", "maildrop.cc", "mailnesia.com",
  "dropmail.me", "1secmail.com", "emailfake.com", "generator.email", "fakemailgenerator.com", "trashmail.com",
  "10minutemail.com", "getnada.com", "inboxkitten.com", "mohmal.com", "moakt.com", "tempail.com",
  "mail-temp.com", "tempmail.plus", "emailondeck.com", "burnermail.io", "spamgourmet.com",
];

/** Lista pública y mantenida de dominios descartables (~10.000), cacheada 12 horas. */
const REMOTE_LIST_URL =
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";
let remoteList: { set: Set<string>; at: number } | null = null;

export async function getRemoteDisposableDomains(): Promise<Set<string>> {
  if (remoteList && Date.now() - remoteList.at < 12 * 60 * 60 * 1000) return remoteList.set;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(REMOTE_LIST_URL, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      const set = new Set(
        text
          .split(/\r?\n/)
          .map((l) => l.trim().toLowerCase())
          .filter((l) => l && !l.startsWith("#"))
      );
      if (set.size > 1000) {
        remoteList = { set, at: Date.now() };
        return set;
      }
    }
  } catch {
    // sin conexión a la lista: se usan la lista propia y el control por servidor de correo
  }
  return remoteList?.set || new Set<string>();
}

function matchesDomainList(domain: string, list: { has(v: string): boolean }): boolean {
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (list.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

function isDisposableMxHost(host: string): boolean {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  return DISPOSABLE_MX_HOSTS.some((d) => h === d || h.endsWith("." + d)) || matchesDomainList(h, DISPOSABLE_DOMAINS);
}

const COMMON_TYPOS: Record<string, string> = {
  "gamail.com": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gnail.com": "gmail.com", "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmai.com": "hotmail.com", "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com", "outlok.com": "outlook.com", "outllok.com": "outlook.com",
};

function extraBlockedDomains(): Set<string> {
  return new Set(
    String(process.env.BLOCKED_EMAIL_DOMAINS || "")
      .split(/[,\s]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function emailDomain(email: string): string {
  return String(email || "").trim().toLowerCase().split("@")[1] || "";
}

/** true si el dominio (o un dominio padre) es de correo temporal. */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  const extra = extraBlockedDomains();
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (DISPOSABLE_DOMAINS.has(candidate) || extra.has(candidate)) return true;
  }
  return false;
}

/** Sugerencia si el dominio parece un error de tipeo ("gamail.com" → "gmail.com"). */
export function suggestEmailDomain(email: string): string | null {
  return COMMON_TYPOS[emailDomain(email)] || null;
}

/**
 * Forma canónica para detectar el mismo correo usado varias veces: sin "+algo" y, en Gmail, sin
 * puntos (juan.perez+1@gmail.com y juanperez@gmail.com son la misma casilla).
 */
export function canonicalEmail(email: string): string {
  const [rawLocal, rawDomain] = String(email || "").trim().toLowerCase().split("@");
  if (!rawLocal || !rawDomain) return String(email || "").trim().toLowerCase();
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Servidores de correo (MX) del dominio. null si no se pudo consultar (no bloquea). */
export async function getMxHosts(email: string): Promise<string[] | null> {
  const domain = emailDomain(email);
  if (!domain) return [];
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 2500));
  try {
    const result = await Promise.race([dns.resolveMx(domain), timeout]);
    if (result === "timeout") return null;
    return Array.isArray(result) ? result.map((r) => String(r.exchange || "").toLowerCase()) : [];
  } catch (err: any) {
    const code = String(err?.code || "");
    // Dominio inexistente o sin registros de correo: no recibe mails
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "ENOTIMP") return [];
    return null;
  }
}

/** true si el dominio tiene servidores de correo (MX). Ante un error de DNS no bloquea. */
export async function domainReceivesEmail(email: string): Promise<boolean> {
  const hosts = await getMxHosts(email);
  return hosts === null || hosts.length > 0;
}

/** Descartable por la lista propia, la lista pública o porque recibe en servidores de correo temporal. */
export async function isDisposableEmailDeep(email: string): Promise<boolean> {
  if (isDisposableEmail(email)) return true;
  const domain = emailDomain(email);
  if (!domain) return false;
  if (matchesDomainList(domain, await getRemoteDisposableDomains())) return true;
  const hosts = await getMxHosts(email);
  return Array.isArray(hosts) && hosts.some(isDisposableMxHost);
}

export type EmailCheck = { ok: true } | { ok: false; error: string };

/** Valida el correo de un registro nuevo. */
export async function checkRegistrationEmail(email: string): Promise<EmailCheck> {
  const suggestion = suggestEmailDomain(email);
  if (suggestion) {
    return { ok: false, error: `Revisá tu correo: ¿quisiste decir @${suggestion}?` };
  }
  if (await isDisposableEmailDeep(email)) {
    return {
      ok: false,
      error: "No se permiten correos temporales o descartables. Registrate con tu correo personal o de tu negocio.",
    };
  }
  if (!(await domainReceivesEmail(email))) {
    return { ok: false, error: "Ese correo no puede recibir mensajes. Revisá que esté bien escrito." };
  }
  return { ok: true };
}
