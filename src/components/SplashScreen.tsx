"use client";

import React, { useEffect, useState } from "react";

export function SplashScreen() {
  const [shouldRender, setShouldRender] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Verificar si ya se mostró en la sesión actual
    if (typeof window !== "undefined") {
      const alreadyShown = sessionStorage.getItem("haba_splash_shown");
      if (alreadyShown) {
        setShouldRender(false);
        return;
      }

      // Marcar como mostrado para esta sesión
      sessionStorage.setItem("haba_splash_shown", "true");

      // Tiempo mínimo de presencia de marca (1100ms)
      const timer = setTimeout(() => {
        setIsFading(true);

        // Desmontar completamente del DOM tras la animación de salida (500ms)
        const unmountTimer = setTimeout(() => {
          setShouldRender(false);
        }, 500);

        return () => clearTimeout(unmountTimer);
      }, 1100);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      aria-hidden={isFading}
      className={`fixed inset-0 z-[9999999] flex flex-col items-center justify-center bg-[#F6F7F2] select-none ${
        isFading
          ? "opacity-0 pointer-events-none transition-opacity duration-500 ease-out"
          : "opacity-100"
      }`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        maxHeight: "100dvh",
      }}
    >
      <div className="relative flex flex-col items-center justify-center px-4 animate-in fade-in zoom-in-95 duration-300">
        {/* Logo oficial HABA transparente sin recuadros ni bordes */}
        <div className="w-28 h-28 sm:w-36 sm:h-36 relative flex items-center justify-center bg-transparent">
          <img
            src="/LogoHaba.png?v=2"
            alt="Logo HABA"
            className="w-full h-full object-contain bg-transparent select-none pointer-events-none drop-shadow-none"
            draggable={false}
          />
        </div>

        {/* Identidad de marca y slogan */}
        <div className="mt-4 text-center flex flex-col items-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#3BB578] tracking-tight font-display">
            HABA
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-neutral-500 mt-1 font-body max-w-[260px] sm:max-w-none">
            Tu aliado en cada producto y presupuesto
          </p>

          {/* Indicador de carga sutil animado */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3BB578] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-[#3BB578] animate-pulse [animation-delay:200ms]" />
            <span className="w-2 h-2 rounded-full bg-[#3BB578] animate-pulse [animation-delay:400ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
