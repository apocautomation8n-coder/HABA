"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, ShoppingBag, Receipt, Sparkles, LogOut } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setUser(data.user);
      }
    });
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="w-full flex flex-col py-4 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HabaMascot size={42} />
          <div>
            <h1 className="text-lg font-bold text-neutral-800">¡Hola! 🌱</h1>
            <p className="text-xs text-neutral-500">¿Qué querés hacer hoy?</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Tarjeta Mascota Consejo */}
      <div className="bg-[#e5f2e6] border border-[#cce5ce] rounded-3xl p-4 flex items-center gap-3">
        <HabaMascot size={60} />
        <div>
          <p className="text-xs font-bold text-[#2a4f2f]">¡Bienvenida a HABA!</p>
          <p className="text-xs text-[#3b7c42] mt-0.5">
            Cada paso te acerca a conocer el verdadero costo de tus productos.
          </p>
        </div>
      </div>

      {/* Accesos directos principales */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#e5f2e6] text-[#3b7c42] flex items-center justify-center">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-neutral-700">Agregar Insumo</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-neutral-700">Crear Producto</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-neutral-700">Presupuestos</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-neutral-700">Mis Productos</span>
        </div>
      </div>
    </div>
  );
}
