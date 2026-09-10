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
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-[#eef2eb] shadow-[0_-4px_20px_rgba(0,0,0,0.04)] px-3 py-1.5 transition-all">
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
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "text-[#3b7c42] font-bold"
                    : "text-neutral-400 hover:text-neutral-600 font-medium"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-[#e5f2e6] text-[#306236] scale-110 shadow-sm"
                      : "bg-transparent text-neutral-400"
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

