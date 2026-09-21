"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Boxes, ShoppingBag, Receipt, Wallet, Settings, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { checkIsAdmin, getUserDisplayName } from "@/lib/auth-helpers";
import { getOutdatedProductsCount } from "@/lib/products";
import { HabaOnboardingMascot } from "@/components/HabaOnboardingMascot";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const baseNavItems: NavItem[] = [
  { label: "Inicio", href: "/dashboard", icon: Home },
  { label: "Insumos", href: "/insumos", icon: Boxes },
  { label: "Productos", href: "/productos", icon: ShoppingBag },
  { label: "Presupuestos", href: "/presupuestos", icon: Receipt },
  { label: "Gastos", href: "/gastos", icon: Wallet },
  { label: "Ajustes", href: "/configuracion", icon: Settings },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [productAlertsCount, setProductAlertsCount] = useState(0);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function checkAdminAndAlerts() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const name = getUserDisplayName(user).split(" ")[0];
          setUserName(name);

          // 1. Verificación inmediata por email o metadata de Auth
          if (checkIsAdmin(user)) {
            setIsAdmin(true);
          } else {
            // 2. Verificación por endpoint seguro con service role
            try {
              const res = await fetch("/api/user/profile");
              if (res.ok) {
                const data = await res.json();
                if (data.isAdmin) {
                  setIsAdmin(true);
                }
              }
            } catch {
              // Ignorar error de red secundario
            }
          }

          // Cargar cantidad de alertas en productos (Punto H)
          const alertCount = await getOutdatedProductsCount(supabase);
          setProductAlertsCount(alertCount);
        }
      } catch (err) {
        console.error("Error checking role in BottomNav:", err);
      }
    }
    checkAdminAndAlerts();
  }, [supabase, pathname]);

  const navItems = isAdmin
    ? [
        ...baseNavItems,
        { label: "Admin", href: "/admin", icon: ShieldCheck },
      ]
    : baseNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-[#EAF0E8] shadow-[0_-4px_20px_rgba(59,181,120,0.05)] px-1 sm:px-2 pt-1 pb-[max(env(safe-area-inset-bottom),6px)] transition-all md:hidden">
      {/* Mascota Onboarding anclada de forma absoluta sobre el ítem Inicio */}
      {pathname === "/dashboard" && (
        <HabaOnboardingMascot userName={userName} />
      )}

      <ul className="flex items-center justify-between gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const isProductItem = item.href === "/productos";
          const hasProductAlert = isProductItem && productAlertsCount > 0;

          return (
            <li key={item.href} className="flex-1 min-w-0">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 font-body ${
                  isActive
                    ? "text-[#3BB578] font-bold"
                    : "text-[#7A7A7A] hover:text-[#2B2B2B] font-medium"
                }`}
              >
                <div
                  className={`relative p-1 sm:p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-[#DCF4D7] text-[#3BB578] scale-105 shadow-xs"
                      : "bg-transparent text-[#7A7A7A]"
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
                  {hasProductAlert && (
                    <span 
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 border-2 border-white rounded-full animate-pulse shadow-xs" 
                      title={`${productAlertsCount} producto(s) con aumento de costos`}
                    />
                  )}
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] mt-0.5 tracking-tighter sm:tracking-tight truncate w-full text-center block leading-tight">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
