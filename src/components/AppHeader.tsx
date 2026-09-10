"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";

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
    <header className="w-full flex items-center justify-between pb-3 pt-1 border-b border-[#eef2eb] mb-4">
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

      <span className="text-[10px] bg-[#e5f2e6] text-[#306236] font-semibold px-2 py-0.5 rounded-full border border-[#cce5ce]">
        Amaoto
      </span>
    </header>
  );
};
