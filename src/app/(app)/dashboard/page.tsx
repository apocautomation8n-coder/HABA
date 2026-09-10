"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, ShoppingBag, Receipt, Sparkles, DollarSign, ArrowRight } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { InstallPwaModal } from "@/components/InstallPwaModal";

export default function DashboardPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState<string>("");
  const [counts, setCounts] = useState({ supplies: 0, products: 0, quotes: 0 });

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, business_name")
          .eq("id", user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name.split(" ")[0]);
        } else if (user.email) {
          setUserName(user.email.split("@")[0]);
        }

        // Cargar contadores básicos
        const [suppliesRes, productsRes, quotesRes] = await Promise.all([
          supabase.from("supplies").select("id", { count: "exact", head: true }),
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("quotes").select("id", { count: "exact", head: true }),
        ]);

        setCounts({
          supplies: suppliesRes.count || 0,
          products: productsRes.count || 0,
          quotes: quotesRes.count || 0,
        });
      }
    }
    loadData();
  }, [supabase]);

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Botón / Banner de Descarga PWA */}
      <InstallPwaModal />

      {/* Tarjeta Mascota Consejo */}
      <div className="bg-[#e5f2e6] border border-[#cce5ce] rounded-3xl p-4 flex items-center gap-3.5 shadow-sm">
        <HabaMascot size={64} className="flex-shrink-0" />
        <div>
          <h2 className="text-sm font-bold text-[#2a4f2f]">
            ¡Hola{userName ? `, ${userName}` : ""}! 🌿
          </h2>
          <p className="text-xs text-[#3b7c42] mt-0.5 leading-relaxed">
            Cada paso te acerca a conocer el verdadero costo de tus productos y cobrar lo que vale tu trabajo.
          </p>
        </div>
      </div>

      {/* Accesos directos principales (Grid 2x2) */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/insumos"
          className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm hover:shadow-md hover:border-[#cce5ce] transition flex flex-col items-center text-center space-y-2 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#e5f2e6] text-[#3b7c42] flex items-center justify-center group-hover:scale-110 transition-transform">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-bold text-neutral-800">Insumos</span>
            <span className="text-[10px] text-neutral-400">
              {counts.supplies} registrado{counts.supplies === 1 ? "" : "s"}
            </span>
          </div>
        </Link>

        <Link
          href="/productos"
          className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm hover:shadow-md hover:border-rose-200 transition flex flex-col items-center text-center space-y-2 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-bold text-neutral-800">Productos</span>
            <span className="text-[10px] text-neutral-400">
              {counts.products} receta{counts.products === 1 ? "" : "s"}
            </span>
          </div>
        </Link>

        <Link
          href="/presupuestos"
          className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm hover:shadow-md hover:border-amber-200 transition flex flex-col items-center text-center space-y-2 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-bold text-neutral-800">Presupuestos</span>
            <span className="text-[10px] text-neutral-400">
              {counts.quotes} emitido{counts.quotes === 1 ? "" : "s"}
            </span>
          </div>
        </Link>

        <Link
          href="/gastos"
          className="bg-white p-4 rounded-3xl border border-[#eef2eb] shadow-sm hover:shadow-md hover:border-sky-200 transition flex flex-col items-center text-center space-y-2 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-bold text-neutral-800">Gastos Fijos</span>
            <span className="text-[10px] text-neutral-400">Mano de obra</span>
          </div>
        </Link>
      </div>

      {/* Banner / Tip inferior */}
      <div className="bg-white rounded-3xl p-4 border border-[#eef2eb] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100/60 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-800">
              ¿Por dónde empezar?
            </p>
            <p className="text-[11px] text-neutral-500">
              Cargá tus insumos para luego armar tus productos.
            </p>
          </div>
        </div>
        <Link
          href="/insumos"
          className="p-2 text-[#3b7c42] hover:bg-[#e5f2e6] rounded-xl transition"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
