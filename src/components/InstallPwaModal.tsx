"use client";

import React, { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X, Bell, CheckCircle2, Sparkles, Smartphone } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";

export const InstallPwaModal: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  // Estado de notificaciones
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifActivated, setNotifActivated] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isRunningStandalone);

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Capturar evento para Android/Chrome/Edge
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Revisar permiso actual de notificaciones
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "granted") {
        setNotifActivated(true);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      setShowIosGuide(true);
    }
  };

  const handleActivateNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Tu navegador actual no soporta notificaciones web.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === "granted") {
        setNotifActivated(true);
        new Notification("HABA 🌱", {
          body: "¡Notificaciones activadas! Te avisaremos cuando tus costos o stock se actualicen.",
          icon: "/icon-192.png",
        });
      } else if (permission === "denied") {
        alert(
          "Las notificaciones fueron bloqueadas en tu navegador. Podés activarlas desde la configuración de tu navegador."
        );
      }
    } catch (err) {
      console.error("Error solicitando notificaciones:", err);
    }
  };

  return (
    <div className="w-full space-y-2 mb-2">
      {/* Botón / Banner de Notificaciones si no están activas */}
      {!notifActivated && (
        <div className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-3 shadow-sm flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-amber-900 truncate">
                Avisos de Stock y Aumentos
              </h4>
              <p className="text-[10px] text-amber-700 truncate">
                Recibí alertas en tu celular al instante
              </p>
            </div>
          </div>

          <button
            onClick={handleActivateNotifications}
            className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1 flex-shrink-0"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Activar</span>
          </button>
        </div>
      )}

      {/* Banner de Instalación PWA (si no está ya instalada) */}
      {!isStandalone && !dismissedInstall && (
        <div className="w-full bg-[#DCF4D7] border border-[#C3EBC0] rounded-3xl p-3.5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <HabaMascot size={42} className="flex-shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-[#1F7A4C] flex items-center gap-1 truncate">
                <span>Descargar App HABA</span>
                <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
              </h4>
              <p className="text-[11px] text-[#3BB578] truncate">
                Instálala directamente en tu pantalla de inicio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="py-1.5 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
            <button
              onClick={() => setDismissedInstall(true)}
              className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg"
              title="Ocultar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Guía Directa para iPhone / Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <HabaMascot size={36} />
                <h3 className="text-sm font-bold text-neutral-800">
                  Instalar HABA en tu iPhone
                </h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-neutral-600">
                En Safari de iOS, Apple requiere estos 2 toques rápidos:
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-sky-50 rounded-2xl border border-sky-100">
                  <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center flex-shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-sky-900 font-medium leading-snug">
                    1. Tocá el botón <strong>Compartir</strong> en la barra inferior de Safari.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-emerald-900 font-medium leading-snug">
                    2. Elegí <strong>"Agregar a pantalla de inicio"</strong> y tocá <strong>"Agregar"</strong>.
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/70 text-center">
                <p className="text-[11px] text-neutral-500">
                  ¡Listo! Se abrirá como una aplicación nativa sin barra de navegación.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl transition shadow-sm"
            >
              ¡Entendido, gracias!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
