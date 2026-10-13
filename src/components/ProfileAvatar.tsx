import React from "react";
import { User } from "lucide-react";

interface ProfileAvatarProps {
  url?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  iconSize?: number;
}

/**
 * Verifica si la URL proporcionada es un avatar o logo subido por el usuario,
 * excluyendo cualquier recurso por defecto de la marca HABA o placeholders.
 */
export function isRealUserAvatar(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("logohaba") ||
    lower.includes("haba-mascot") ||
    lower.includes("haba-avatar") ||
    lower === "/logo.png" ||
    lower === "/icon.png" ||
    lower === "null" ||
    lower === "undefined"
  ) {
    return false;
  }
  return true;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  url,
  alt = "Foto de perfil",
  className = "w-16 h-16 rounded-2xl",
  iconClassName = "text-gray-400",
  iconSize = 32,
}) => {
  if (isRealUserAvatar(url)) {
    return (
      <img
        src={url!.trim()}
        alt={alt}
        className={`${className} object-cover border-2 border-[#3BB578] shadow-xs`}
      />
    );
  }

  return (
    <div
      className={`${className} bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shadow-xs`}
      aria-label="Avatar por defecto"
    >
      <User className={iconClassName} size={iconSize} strokeWidth={1.75} />
    </div>
  );
};
