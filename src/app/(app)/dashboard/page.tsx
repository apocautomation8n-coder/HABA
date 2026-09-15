"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, ShoppingBag, Receipt, Sparkles, DollarSign, ArrowRight, ShieldCheck } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { InstallPwaModal } from "@/components/InstallPwaModal";
import { checkIsAdmin, getUserDisplayName } from "@/lib/auth-helpers";

export default function DashboardPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [counts, setCounts] = useState({ supplies: 0, products: 0, quotes: 0 });

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 1. Verificación inmediata de Admin
        if (checkIsAdmin(user)) {
          setIsAdmin(true);
        }

        const initialName = getUserDisplayName(user).split(" ")[0];
        setUserName(initialName);

        // 2. Traer perfil extendido de API segura
        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const data = await res.json();
            if (data.isAdmin) setIsAdmin(true);
            if (data.profile?.full_name) {
              setUserName(data.profile.full_name.split(" ")[0]);
            }
          }
        } catch {
          // ignore
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
    <div className="w-full flex flex-col space-y-3 pb-24">
      {/* Botón / Banner de Descarga PWA */}
      <InstallPwaModal />

      {/* Banner Especial SuperAdmin si es Gio / Admin */}
      {isAdmin && (
        <Link
          href="/admin"
          className="bg-gradient-to-r from-emerald-500 to-[#1F7A4C] rounded-3xl p-3.5 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold font-display flex items-center gap-1.5">
                <span>Panel SuperAdmin</span>
                <span className="text-[9.5px] bg-white/25 px-1.5 py-0.2 rounded-full font-body">
                  Gio
                </span>
              </p>
              <p className="text-[10.5px] text-white/90 font-body">
                Crear usuarias, pausar/activar cuentas y bajas
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-white text-[#1F7A4C] font-bold rounded-xl text-xs group-hover:scale-105 transition-transform shadow-xs">
            Gestionar →
          </span>
        </Link>
      )}

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
              {counts.products} producto{counts.products === 1 ? "" : "s"}
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

      {/* Tarjeta Destacada: Comenzá acá */}
      <Link
        href="/insumos"
        className="relative overflow-hidden bg-gradient-to-r from-[#DCF4D7] via-white to-[#DCF4D7]/60 rounded-3xl p-4 border-2 border-[#3BB578]/50 shadow-sm hover:shadow-md hover:border-[#3BB578] transition-all group flex items-center justify-between"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#3BB578] text-white flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-110 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="inline-flex items-center justify-center text-xs font-bold bg-[#3BB578] text-white px-3.5 py-1 rounded-full font-body shadow-xs tracking-wide">
              Comenzá acá
            </span>
            <p className="text-[11.5px] text-[#2B2B2B] mt-1.5 font-body leading-snug">
              Cargá tus <strong>insumos y packaging</strong> para luego armar tus productos y calcular tus precios.
            </p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#3BB578] text-white flex items-center justify-center flex-shrink-0 group-hover:translate-x-1 transition-transform ml-2 shadow-xs">
          <ArrowRight className="w-4 h-4" />
        </div>
      </Link>
    </div>
  );
}
