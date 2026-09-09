import React from "react";

interface HabaMascotProps {
  className?: string;
  size?: number;
  mood?: "happy" | "waving" | "calculating";
}

export const HabaMascot: React.FC<HabaMascotProps> = ({
  className = "",
  size = 100,
  mood = "happy",
}) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 160 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform hover:scale-105"
      >
        {/* Hojas / Brote en la cabeza */}
        <path
          d="M80 32C80 32 70 12 55 18C42 24 54 44 72 38"
          fill="#3b7c42"
          stroke="#254d2a"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M78 32C78 32 88 10 102 14C115 19 105 40 86 36"
          fill="#4f9856"
          stroke="#254d2a"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M78 35L77 48"
          stroke="#254d2a"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Cuerpo del poroto / haba */}
        <path
          d="M78 44C115 44 142 75 138 116C134 153 108 172 78 172C46 172 22 150 20 114C18 73 43 44 78 44Z"
          fill="#b8e09f"
          stroke="#254d2a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Brillo en la frente */}
        <ellipse cx="60" cy="62" rx="10" ry="6" transform="rotate(-20 60 62)" fill="#d6f2c2" />

        {/* Mejillas sonrosadas (kawaii) */}
        <ellipse cx="46" cy="118" rx="8" ry="5.5" fill="#fca5a5" opacity="0.85" />
        <ellipse cx="112" cy="116" rx="8" ry="5.5" fill="#fca5a5" opacity="0.85" />

        {/* Ojos */}
        <circle cx="56" cy="104" r="5" fill="#1f2937" />
        <circle cx="58" cy="102" r="1.8" fill="white" />
        
        <circle cx="102" cy="102" r="5" fill="#1f2937" />
        <circle cx="104" cy="100" r="1.8" fill="white" />

        {/* Sonrisa */}
        <path
          d="M74 114C74 114 78 120 84 120C90 120 94 114 94 114"
          stroke="#1f2937"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Brazos pequeños */}
        <path
          d="M23 108C15 106 10 114 18 122C24 126 27 122 27 122"
          stroke="#254d2a"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="#b8e09f"
        />
        <path
          d="M136 106C145 104 150 112 142 120C136 124 133 120 133 120"
          stroke="#254d2a"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="#b8e09f"
        />
      </svg>
    </div>
  );
};
