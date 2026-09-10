"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Boxes, ShoppingBag, Receipt, Settings } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Inicio", href: "/dashboard", icon: Home },
  { label: "Insumos", href: "/insumos", icon: Boxes },
  { label: "Productos", href: "/productos", icon: ShoppingBag },
  { label: "Presupuestos", href: "/presupuestos", icon: Receipt },
  { label: "Ajustes", href: "/configuracion", icon: Settings },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-[#EAF0E8] shadow-[0_-4px_20px_rgba(59,181,120,0.05)] px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] transition-all">
      <ul className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 font-body ${
                  isActive
                    ? "text-[#3BB578] font-bold"
                    : "text-[#7A7A7A] hover:text-[#2B2B2B] font-medium"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-[#DCF4D7] text-[#3BB578] scale-110 shadow-sm"
                      : "bg-transparent text-[#7A7A7A]"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">
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
