"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, ShoppingBag, Receipt, User } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/insumos", label: "Insumos", icon: Package },
    { href: "/productos", label: "Productos", icon: ShoppingBag },
    { href: "/presupuestos", label: "Presupuestos", icon: Receipt },
    { href: "/perfil", label: "Perfil", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#eef2eb] px-4 py-2 flex items-center justify-around max-w-md mx-auto shadow-sm">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href === "/insumos" && pathname.startsWith("/insumos"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-150 ${
              isActive
                ? "text-[#3b7c42] font-bold scale-105"
                : "text-neutral-400 hover:text-neutral-600 font-medium"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                isActive ? "bg-[#e5f2e6]" : "bg-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
