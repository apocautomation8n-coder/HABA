/**
 * Utilidad para la persistencia de borradores de formularios en la PWA.
 * Utiliza localStorage (persistente incluso al cerrar la app o reiniciar el teléfono)
 * con fallback a sessionStorage si localStorage está bloqueado o lleno.
 */

export const formDraftStorage = {
  get: <T>(key: string): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const item = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (e) {
      console.warn("Error leyendo borrador del almacenamiento:", e);
      return null;
    }
  },

  set: <T>(key: string, data: T): void => {
    if (typeof window === "undefined") return;
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      // Limpiar sessionStorage legado si existía
      sessionStorage.removeItem(key);
    } catch {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.warn("Almacenamiento no disponible o lleno:", e);
      }
    }
  },

  remove: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {}
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};
