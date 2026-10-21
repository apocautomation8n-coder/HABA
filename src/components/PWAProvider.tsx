"use client";

import React, { useEffect, useState, useCallback } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * PWAProvider:
 * - Registra el Service Worker con ciclo de vida activo (update, skipWaiting, controllerchange).
 * - Supervisa el estado de red (online / offline).
 * - Mecanismo de auto-recuperación (self-healing): detecta errores de carga de chunks
 *   (ChunkLoadError / ERR_FAILED) causados por despliegues nuevos y purga la caché
 *   automáticamente sin requerir que la usuaria borre datos manualmente.
 */
export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  // Función de auto-recuperación ante chunks desactualizados o fallos de Service Worker
  const triggerSelfHealingRecovery = useCallback(async (reason: string) => {
    if (typeof window === "undefined") return;

    // Evitar bucles infinitos de recarga (máximo 1 auto-recuperación cada 20 segundos)
    const RECOVERY_KEY = "haba_sw_recovery_ts";
    const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    const now = Date.now();

    if (now - lastRecovery < 20000) {
      console.warn(`[PWA] Recuperación omitida por límite de frecuencia (${reason})`);
      return;
    }

    console.warn(`[PWA] Error crítico detectado (${reason}). Ejecutando auto-limpieza...`);
    sessionStorage.setItem(RECOVERY_KEY, String(now));

    try {
      // 1. Desregistrar Service Workers obsoletos
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Limpiar todos los almacenes de CacheStorage
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.error("[PWA] Error durante auto-limpieza:", e);
    } finally {
      // 3. Forzar recarga limpia desde la red
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Registro y actualización activa del Service Worker
    if ("serviceWorker" in navigator) {
      let isRefreshing = false;

      // Al cambiar el SW controlador, recargar inmediatamente para tomar la nueva versión
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!isRefreshing) {
          isRefreshing = true;
          window.location.reload();
        }
      });

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Forzar verificación de actualización al cargar
          registration.update().catch(() => {});

          // Detectar cuando hay un nuevo Service Worker esperando
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // Nueva versión lista: forzar activación
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn("[PWA] Error en registro de SW:", error);
        });

      // Chequear actualizaciones al recuperar visibilidad (ej: volver a abrir la app o pestaña)
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          navigator.serviceWorker.ready
            .then((registration) => registration.update())
            .catch(() => {});
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Chequear actualizaciones periódicas cada 15 minutos mientras esté abierta
      const intervalId = setInterval(() => {
        navigator.serviceWorker.ready
          .then((registration) => registration.update())
          .catch(() => {});
      }, 15 * 60 * 1000);

      // Limpieza de listeners de SW al desmontar
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 2. Detección de errores críticos de chunks / ERR_FAILED para auto-limpieza
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || "";
      const isChunkError =
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("failed to fetch dynamically imported module") ||
        msg.includes("ERR_FAILED");

      if (isChunkError && navigator.onLine) {
        event.preventDefault();
        triggerSelfHealingRecovery("ErrorEvent: " + msg);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event.reason?.message || event.reason || "");
      const isChunkError =
        reasonStr.includes("Loading chunk") ||
        reasonStr.includes("ChunkLoadError") ||
        reasonStr.includes("failed to fetch dynamically imported module") ||
        reasonStr.includes("ERR_FAILED");

      if (isChunkError && navigator.onLine) {
        event.preventDefault();
        triggerSelfHealingRecovery("UnhandledRejection: " + reasonStr);
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [triggerSelfHealingRecovery]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 3. Control de conectividad Online / Offline
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setReconnected(true);
      // Forzar chequeo de actualización al volver el internet
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => reg.update())
          .catch(() => {});
      }
      const timer = setTimeout(() => {
        setReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      {/* Barra de estado Offline */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[999999] bg-amber-500 text-white px-3 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top duration-300">
          <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>Modo offline: Estás navegando sin internet. Podés consultar tus costos guardados.</span>
        </div>
      )}

      {/* Notificación de reconexión */}
      {reconnected && (
        <div className="fixed top-0 left-0 right-0 z-[999999] bg-[#1F7A4C] text-white px-3 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top duration-300">
          <Wifi className="w-4 h-4 flex-shrink-0 text-emerald-200" />
          <span>¡Conexión recuperada! Tus datos se sincronizan automáticamente.</span>
        </div>
      )}

      {children}
    </>
  );
}
