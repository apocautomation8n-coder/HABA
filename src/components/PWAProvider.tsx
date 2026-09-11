"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, Wifi, CheckCircle2 } from "lucide-react";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    // 1. Registrar Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registrado con éxito:", registration.scope);
          })
          .catch((error) => {
            console.error("Fallo al registrar Service Worker:", error);
          });
      });
    }

    // 2. Control de estado Online / Offline
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => {
        setIsOffline(false);
        setReconnected(true);
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
    }
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
