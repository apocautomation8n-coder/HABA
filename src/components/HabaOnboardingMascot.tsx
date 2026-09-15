"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface HabaOnboardingMascotProps {
  userName?: string;
  onDismiss?: () => void;
}

export const HabaOnboardingMascot: React.FC<HabaOnboardingMascotProps> = ({
  userName,
  onDismiss,
}) => {
  const [isMounted, setIsMounted] = useState(true);
  const [mascotEntered, setMascotEntered] = useState(false);
  const [bubbleEntered, setBubbleEntered] = useState(false);
  const [isWinking, setIsWinking] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // 2. Secuencia de Animación (Entrance) - Más lenta y pausada
  useEffect(() => {
    // Step 1: Slide Up Mascota con ritmo pausado y rebote orgánico suave
    const mascotTimer = setTimeout(() => {
      setMascotEntered(true);
    }, 250);

    // Step 2: Fade/Scale Globo (aparece una vez que Haba se acomoda arriba)
    const bubbleTimer = setTimeout(() => {
      setBubbleEntered(true);
    }, 950);

    return () => {
      clearTimeout(mascotTimer);
      clearTimeout(bubbleTimer);
    };
  }, []);

  // 3. Loop de Vida (Idle State) - Alternar opacidad con el guiño cada 3-5 segundos
  useEffect(() => {
    if (!mascotEntered || isDismissing) return;

    const winkInterval = setInterval(() => {
      setIsWinking(true);
      // Guiño rápido de 180ms para simular parpadeo vivo
      const timeout = setTimeout(() => {
        setIsWinking(false);
      }, 180);

      return () => clearTimeout(timeout);
    }, 3800);

    return () => clearInterval(winkInterval);
  }, [mascotEntered, isDismissing]);

  // 4. Interacción (Dismiss): Fade-out de globo y slide-down de mascota antes de desmontar
  const handleDismiss = useCallback(() => {
    if (isDismissing) return;
    setIsDismissing(true);

    // Globo hace fade-out y scale-down
    setBubbleEntered(false);

    // Mascota hace slide-down suave escondiéndose detrás de la barra de navegación
    const mascotSlideTimer = setTimeout(() => {
      setMascotEntered(false);
    }, 120);

    // Desmontar el componente tras completarse la animación de salida
    const unmountTimer = setTimeout(() => {
      setIsMounted(false);
      onDismiss?.();
    }, 600);

    return () => {
      clearTimeout(mascotSlideTimer);
      clearTimeout(unmountTimer);
    };
  }, [isDismissing, onDismiss]);

  if (!isMounted) return null;

  return (
    // 1. Contenedor Principal: Posicionado de forma absoluta sobre la barra inferior, alineado a la izquierda (sobre "Inicio")
    <div
      className="absolute bottom-full left-2 sm:left-4 z-40 mb-[-2px] flex items-end gap-2.5 pointer-events-none select-none"
      style={{
        // Evita que la mascota sobresalga por debajo del borde superior de la barra de navegación al deslizarse
        clipPath: "inset(-300px -300px 0px -300px)",
      }}
    >
      {/* Capa 1: Mascota con slide-up spring overshoot y loop de guiño */}
      <div
        className="pointer-events-auto relative cursor-pointer flex-shrink-0"
        onClick={() => {
          if (!isDismissing) {
            setIsWinking(true);
            setTimeout(() => setIsWinking(false), 250);
          }
        }}
        title="Haba"
        style={{
          width: "72px",
          height: "76px",
          transform: mascotEntered ? "translateY(0)" : "translateY(110%)",
          transition: isDismissing
            ? "transform 450ms cubic-bezier(0.4, 0, 1, 1)"
            : "transform 850ms cubic-bezier(0.34, 1.3, 0.64, 1)",
        }}
      >
        {/* Mascota con ojos abiertos */}
        <img
          src="/haba-mascot-open.png"
          alt="Haba Mascota"
          className={`w-full h-full object-contain absolute inset-0 drop-shadow-md transition-opacity duration-100 ${
            isWinking ? "opacity-0" : "opacity-100"
          }`}
          draggable={false}
        />

        {/* Mascota con guiño (loop de vida intermitente) */}
        <img
          src="/haba-mascot-wink.png"
          alt="Haba Mascota Guiño"
          className={`w-full h-full object-contain absolute inset-0 drop-shadow-md transition-opacity duration-100 ${
            isWinking ? "opacity-100" : "opacity-0"
          }`}
          draggable={false}
        />
      </div>

      {/* Capa 2: Globo de Diálogo Nativo dinámico con transform-origin bottom-left */}
      <div
        className="pointer-events-auto relative mb-3 bg-[#E8F5E9] border-2 border-[#A5D6A7] rounded-2xl p-2.5 sm:p-3 shadow-lg max-w-[230px] sm:max-w-[270px]"
        style={{
          transformOrigin: "bottom left",
          transform: bubbleEntered ? "scale(1)" : "scale(0)",
          opacity: bubbleEntered ? 1 : 0,
          transition: isDismissing
            ? "transform 220ms ease-in, opacity 200ms ease-in"
            : "transform 350ms cubic-bezier(0.34, 1.25, 0.64, 1), opacity 320ms ease-out",
        }}
      >
        {/* Pseudo-elemento / Colita del globo apuntando hacia Haba */}
        <div
          className="absolute -left-2 bottom-2.5 w-0 h-0 border-t-[5px] border-t-transparent border-r-[8px] border-r-[#A5D6A7] border-b-[5px] border-b-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute -left-[6px] bottom-2.5 w-0 h-0 border-t-[5px] border-t-transparent border-r-[8px] border-r-[#E8F5E9] border-b-[5px] border-b-transparent"
          aria-hidden="true"
        />

        {/* Header con texto inyectable y botón cerrar X */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1">
            <h3 className="text-xs sm:text-[13px] font-bold text-[#1B5E20] font-display leading-tight flex items-center gap-1">
              <span>¡Hora de empezar{userName ? `, ${userName}` : ""}!</span>
              <span>🌱</span>
            </h3>
            <p className="text-[11px] text-[#2E7D32] mt-0.5 leading-snug font-body">
              Cargá tus insumos para empezar a calcular tus costos.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar saludo"
            className="w-5 h-5 rounded-full flex items-center justify-center text-[#2E7D32]/70 hover:text-[#1B5E20] hover:bg-[#C8E6C9] transition-colors -mr-1 -mt-0.5 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
