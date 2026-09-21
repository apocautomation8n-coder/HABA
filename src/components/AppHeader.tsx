"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Home,
  Boxes,
  ShoppingBag,
  Receipt,
  DollarSign,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { NotificationsModal } from "@/components/NotificationsModal";
import { checkIsAdmin } from "@/lib/auth-helpers";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
}) => {
  const pathname = usePathname();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadProfileAndAlerts() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (checkIsAdmin(user)) {
          setIsAdmin(true);
        }

        // Carga inmediata de user_metadata
        if (user.user_metadata?.business_name) {
          setBusinessName(user.user_metadata.business_name);
        } else if (user.user_metadata?.full_name) {
          setBusinessName(user.user_metadata.full_name);
        }
        if (user.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        }

        // Carga complementaria por API segura
        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const data = await res.json();
            if (data.isAdmin) {
              setIsAdmin(true);
            }
            if (data.profile?.business_name) {
              setBusinessName(data.profile.business_name);
            } else if (data.profile?.full_name) {
              setBusinessName(data.profile.full_name);
            }
            if (data.profile?.avatar_url) {
              setAvatarUrl(data.profile.avatar_url);
            }
          }
        } catch {
          // ignore
        }

        // Cargar alertas no leídas para la campanita
        try {
          const { getOutdatedProductsCount } = await import("@/lib/products");
          const outdatedProductsCount = await getOutdatedProductsCount(supabase);
          
          let readIds: string[] = [];
          try {
            const stored = localStorage.getItem("haba_read_notifications");
            if (stored) readIds = JSON.parse(stored);
          } catch {
            // ignore
          }

          // Si hay productos con alerta no marcados como leídos
          let count = 0;
          if (outdatedProductsCount > 0) {
            count += outdatedProductsCount;
          }
          setUnreadCount(count);
        } catch {
          // ignore
        }
      }
    }
    loadProfileAndAlerts();
  }, [supabase]);

  const navItems = [
    { label: "Inicio", href: "/dashboard", icon: Home },
    { label: "Insumos", href: "/insumos", icon: Boxes },
    { label: "Productos", href: "/productos", icon: ShoppingBag },
    { label: "Presupuestos", href: "/presupuestos", icon: Receipt },
    { label: "Gastos", href: "/gastos", icon: DollarSign },
    { label: "Ajustes", href: "/configuracion", icon: Settings },
    ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <>
      <header className="w-full flex items-center justify-between pb-3 pt-1 border-b border-[#EAF0E8] mb-4 gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Logo"
              className="w-9 h-9 rounded-xl object-cover border border-[#C3EBC0] flex-shrink-0"
            />
          ) : (
            <HabaMascot size={36} />
          )}
          <div>
            <h1 className="text-base font-extrabold text-[#2B2B2B] leading-tight flex items-center gap-1.5 font-display">
              <span className="text-[#3BB578]">HABA</span>
              {businessName && (
                <span className="text-xs font-normal text-[#7A7A7A] font-body truncate max-w-[140px] sm:max-w-none">
                  · {businessName}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-[#7A7A7A] font-medium font-body hidden sm:block">
              {subtitle || "Costos, precios y presupuestos"}
            </p>
          </div>
        </Link>

        {/* Navegación Desktop Horizontal */}
        <nav className="hidden md:flex items-center gap-1 bg-[#F6F7F2] p-1 rounded-2xl border border-[#EAF0E8]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const isProductItem = item.href === "/productos";
            const hasAlert = isProductItem && unreadCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-white text-[#1F7A4C] shadow-xs"
                    : "text-[#7A7A7A] hover:text-[#2B2B2B] hover:bg-white/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {hasAlert && (
                  <span
                    className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"
                    title="Productos con alertas de costo"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Botón de Notificaciones */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-2 text-[#7A7A7A] hover:text-[#2B2B2B] hover:bg-[#DCF4D7]/60 rounded-xl transition"
            title="Notificaciones de stock y precios"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] font-semibold px-2 py-0.5 rounded-full border border-[#C3EBC0] font-body hidden sm:inline-block">
            Amaoto
          </span>
        </div>
      </header>

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
        }}
        onCountChange={(count) => setUnreadCount(count)}
      />
    </>
  );
};
