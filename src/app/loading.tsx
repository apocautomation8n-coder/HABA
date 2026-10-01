import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#F6F7F2]">
      {/* Contenedor completamente limpio y transparente, sin recuadro blanco, sin bordes ni sombras forzadas */}
      <div className="relative flex flex-col items-center justify-center bg-transparent">
        <div className="w-24 h-24 sm:w-28 sm:h-28 relative flex items-center justify-center bg-transparent animate-bounce">
          <img
            src="/LogoHaba.png?v=2"
            alt="Cargando HABA..."
            className="w-full h-full object-contain bg-transparent select-none pointer-events-none"
          />
        </div>
        <div className="mt-4 text-center">
          <h2 className="text-xl font-extrabold text-[#3BB578] tracking-tight font-display">
            HABA
          </h2>
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3BB578] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-[#3BB578] animate-pulse [animation-delay:200ms]" />
            <span className="w-2 h-2 rounded-full bg-[#3BB578] animate-pulse [animation-delay:400ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
