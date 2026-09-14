"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";

interface HabaBottomGreetingProps {
  userName?: string;
}

export const HabaBottomGreeting: React.FC<HabaBottomGreetingProps> = ({ userName }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const [isWaving, setIsWaving] = useState(false);

  useEffect(() => {
    // Animación de entrada al cargar el dashboard
    const timer = setTimeout(() => {
      setHasAnimatedIn(true);
      setIsWaving(true);
      // Detener el saludo continuo a los 3 segundos
      setTimeout(() => setIsWaving(false), 3000);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const handleMascotClick = () => {
    setIsWaving(true);
    setIsOpen(true);
    setTimeout(() => setIsWaving(false), 2000);
  };

  return (
    <div className="fixed bottom-[56px] sm:bottom-[62px] left-0 right-0 z-40 max-w-md mx-auto px-3 pointer-events-none">
      <div className="relative flex items-end gap-2">
        {/* Contenedor de la Mascota en Grande asomándose */}
        <div
          onClick={handleMascotClick}
          className={`pointer-events-auto cursor-pointer select-none transition-all duration-700 transform flex flex-col items-center group ${
            hasAnimatedIn ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
          }`}
          title="¡Tocá a Haba para saludar!"
        >
          {/* Mascota con animación de asomarse y saludar */}
          <div
            className={`relative transition-transform duration-300 ${
              isWaving ? "animate-bounce" : "group-hover:-translate-y-1"
            }`}
          >
            {/* Avatar Haba en Grande (80px) */}
            <HabaMascot size={80} className="drop-shadow-lg" />

            {/* Manitos de Haba agarrándose firmemente del borde superior de la barra */}
            <div className="absolute -bottom-1 left-3 w-3 h-2.5 bg-[#b8e09f] border-2 border-[#254d2a] rounded-full shadow-xs" />
            <div className="absolute -bottom-1 right-3 w-3 h-2.5 bg-[#b8e09f] border-2 border-[#254d2a] rounded-full shadow-xs" />
          </div>
        </div>

        {/* Cartel / Globito de Saludo emergente */}
        {isOpen && (
          <div className="pointer-events-auto flex-1 mb-2.5 bg-[#DCF4D7]/95 backdrop-blur-md border-2 border-[#3BB578]/50 rounded-3xl p-3 shadow-xl relative animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300">
            {/* Header del diálogo con saludo personalizado y botón de cerrar */}
            <div className="flex items-center justify-between gap-1">
              <h2 className="text-xs sm:text-sm font-bold text-[#1F7A4C] font-display flex items-center gap-1.5">
                <span>¡Hola{userName ? `, ${userName}` : ""}!</span>
                <span className="text-sm">🌿</span>
              </h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[#1F7A4C]/60 hover:text-[#1F7A4C] hover:bg-[#C3EBC0]/50 transition"
                title="Cerrar saludo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mensaje motivacional */}
            <p className="text-[11px] text-[#2E9E65] mt-0.5 leading-snug font-body">
              Cada paso te acerca a conocer el verdadero costo de tus creaciones.
            </p>

            {/* Triangulito indicador del diálogo hacia Haba */}
            <div className="absolute -left-2 bottom-3.5 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-[#3BB578]/50 border-b-[6px] border-b-transparent" />
            <div className="absolute -left-[6px] bottom-3.5 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-[#DCF4D7] border-b-[6px] border-b-transparent" />
          </div>
        )}

        {/* Si el cartel está cerrado, un indicador sutil para volver a abrir */}
        {!isOpen && hasAnimatedIn && (
          <button
            type="button"
            onClick={handleMascotClick}
            className="pointer-events-auto mb-3.5 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md border border-[#3BB578]/40 flex items-center gap-1 animate-in fade-in duration-200"
          >
            <Sparkles className="w-3 h-3 text-[#3BB578]" />
            <span>Ver mensaje</span>
          </button>
        )}
      </div>
    </div>
  );
};
