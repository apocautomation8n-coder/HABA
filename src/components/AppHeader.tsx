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
      <header className="w-full flex items-center justify-between pb-2 pt-1 border-b border-[#EAF0E8] mb-2">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <HabaMascot size={36} />
          <div>
            <h1 className="text-base font-extrabold text-[#2B2B2B] leading-tight flex items-center gap-1.5 font-display">
              <span className="text-[#3BB578]">HABA</span>
              {businessName && (
                <span className="text-xs font-normal text-[#7A7A7A] font-body">
                  · {businessName}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-[#7A7A7A] font-medium font-body">
              {subtitle || "Costos, precios y presupuestos"}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
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

          <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] font-semibold px-2 py-0.5 rounded-full border border-[#C3EBC0] font-body">
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
