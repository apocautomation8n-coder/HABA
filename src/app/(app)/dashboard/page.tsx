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
    <div className="w-full flex flex-col space-y-3 pb-2">
      {/* Botón / Banner de Descarga PWA */}
      <InstallPwaModal />

      {/* Tarjeta Mascota Saludo */}
      <div className="bg-[#DCF4D7] border border-[#C3EBC0] rounded-3xl p-3.5 flex items-center gap-3 shadow-xs">
        <HabaMascot size={56} className="flex-shrink-0" />
        <div>
          <h2 className="text-sm font-bold text-[#1F7A4C] font-display">
            ¡Hola{userName ? `, ${userName}` : ""}! 🌿
          </h2>
          <p className="text-[11px] text-[#2E9E65] mt-0.5 leading-snug font-body">
            Cada paso te acerca a conocer el verdadero costo de tus creaciones.
          </p>
        </div>
      </div>

      {/* Accesos directos — 4 pasteles oficiales */}
      <div className="grid grid-cols-2 gap-2.5">

        {/* Insumos — Verde pastel */}
        <Link
          href="/insumos"
          className="bg-white p-3.5 rounded-3xl border border-[#EAF0E8] shadow-xs hover:shadow-sm hover:border-[#C3EBC0] transition flex flex-col items-center text-center space-y-1.5 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#E4F5E2] text-[#3BB578] flex items-center justify-center group-hover:scale-105 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-[#2B2B2B] font-body">Insumos</span>
            <span className="text-[10px] text-[#7A7A7A] font-body">
              {counts.supplies} registrado{counts.supplies === 1 ? "" : "s"}
            </span>
          </div>
        </Link>

        {/* Productos — Rosa pastel */}
        <Link
          href="/productos"
          className="bg-white p-3.5 rounded-3xl border border-[#EAF0E8] shadow-xs hover:shadow-sm hover:border-[#FFB3B3] transition flex flex-col items-center text-center space-y-1.5 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#FFE3E3] text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-[#2B2B2B] font-body">Productos</span>
            <span className="text-[10px] text-[#7A7A7A] font-body">
              {counts.products} receta{counts.products === 1 ? "" : "s"}
            </span>
          </div>
        </Link>

        {/* Presupuestos — Amarillo pastel */}
        <Link
          href="/presupuestos"
          className="bg-white p-3.5 rounded-3xl border border-[#EAF0E8] shadow-xs hover:shadow-sm hover:border-[#FFD77A] transition flex flex-col items-center text-center space-y-1.5 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#FFF2CE] text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-[#2B2B2B] font-body">Presupuestos</span>
            <span className="text-[10px] text-[#7A7A7A] font-body">
              {counts.quotes} emitido{counts.quotes === 1 ? "" : "s"}
            </span>
          </div>
        </Link>

        {/* Gastos Fijos — Lila pastel */}
        <Link
          href="/gastos"
          className="bg-white p-3.5 rounded-3xl border border-[#EAF0E8] shadow-xs hover:shadow-sm hover:border-[#C9AEED] transition flex flex-col items-center text-center space-y-1.5 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#EBDDF9] text-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-[#2B2B2B] font-body">Gastos Fijos</span>
            <span className="text-[10px] text-[#7A7A7A] font-body">Mano de obra</span>
          </div>
        </Link>
      </div>

      {/* Banner tip inferior */}
      <div className="bg-white rounded-3xl p-3.5 border border-[#EAF0E8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#FFF2CE] text-amber-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#2B2B2B] font-body">
              ¿Por dónde empezar?
            </p>
            <p className="text-[10.5px] text-[#7A7A7A] font-body">
              Cargá tus insumos para luego armar tus recetas y precios.
            </p>
          </div>
        </div>
        <Link
          href="/insumos"
          className="p-1.5 text-[#3BB578] hover:bg-[#DCF4D7] rounded-xl transition"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
