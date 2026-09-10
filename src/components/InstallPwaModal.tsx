"use client";

import React, { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X, CheckCircle2, Sparkles } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";

export const InstallPwaModal: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsIosStandalone] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada (standalone)
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsIosStandalone(isRunningStandalone);

    // Detectar iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Capturar evento de instalación para Android / Chrome / Edge
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback para otros navegadores
      setShowIosModal(true);
    }
  };

  // No mostrar nada si ya está instalada como app o si el usuario la cerró
  if (isStandalone || dismissed) return null;

  return (
    <>
      {/* Banner flotante o integrado en la app */}
      <div className="w-full bg-gradient-to-r from-[#e5f2e6] to-[#f4f9f4] border border-[#cce5ce] rounded-3xl p-3.5 shadow-sm flex items-center justify-between gap-3 mb-3 animate-in fade-in duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <HabaMascot size={40} className="flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-[#2a4f2f] flex items-center gap-1 truncate">
              <span>Instalar HABA en tu celu</span>
              <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
            </h4>
            <p className="text-[11px] text-[#3b7c42] truncate">
              Úsala a pantalla completa sin internet y sin tiendas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="py-1.5 px-3 bg-[#3b7c42] hover:bg-[#326b38] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg"
            title="Ocultar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Instructivo para iPhone / Safari */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#eef2eb] animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <HabaMascot size={36} />
                <h3 className="text-sm font-bold text-neutral-800">
                  Instalar HABA en tu iPhone
                </h3>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <p className="text-xs text-neutral-600">
                Seguí estos 3 simples pasos en Safari para tener HABA como una app nativa:
              </p>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div className="text-xs text-neutral-700">
                    Toca el botón <strong className="text-sky-700">Compartir</strong> (el cuadrado con la flecha hacia arriba <Share className="w-3.5 h-3.5 inline mx-0.5" />) en la barra de Safari.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div className="text-xs text-neutral-700">
                    Deslizá el menú hacia abajo y seleccioná <strong className="text-amber-800">"Agregar a pantalla de inicio"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <div className="text-xs text-neutral-700">
                    Toca <strong className="text-emerald-800">"Agregar"</strong> arriba a la derecha. ¡Y listo! HABA se abrirá desde tu pantalla principal sin barras.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 bg-[#3b7c42] hover:bg-[#326b38] text-white text-xs font-bold rounded-2xl transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
