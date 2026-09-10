"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { NotificationsModal } from "@/components/NotificationsModal";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
}) => {
  const supabase = createClient();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("business_name, full_name")
          .eq("id", user.id)
          .single();

        if (profile?.business_name) {
          setBusinessName(profile.business_name);
        } else if (profile?.full_name) {
          setBusinessName(profile.full_name);
        }
      }
    }
    loadProfile();
  }, [supabase]);

  return (
    <>
      <header className="w-full flex items-center justify-between pb-2 pt-1 border-b border-[#eef2eb] mb-2">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <HabaMascot size={36} />
          <div>
            <h1 className="text-base font-extrabold text-neutral-800 leading-tight flex items-center gap-1.5">
              <span className="text-[#3b7c42]">HABA</span>
              {businessName && (
                <span className="text-xs font-normal text-neutral-400">
                  · {businessName}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              {subtitle || "Costos, precios y presupuestos"}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Botón de Notificaciones de Stock y Precios */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-2 text-neutral-500 hover:text-neutral-800 hover:bg-[#e5f2e6]/60 rounded-xl transition"
            title="Notificaciones de stock y precios"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          <span className="text-[10px] bg-[#e5f2e6] text-[#306236] font-semibold px-2 py-0.5 rounded-full border border-[#cce5ce]">
            Amaoto
          </span>
        </div>
      </header>

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
          setUnreadCount(0);
        }}
        onCountChange={(count) => setUnreadCount(count)}
      />
    </>
  );
};

