"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, ShoppingBag, Receipt, Sparkles, DollarSign, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InstallPwaModal } from "@/components/InstallPwaModal";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";
import { getUserDisplayName } from "@/lib/auth-helpers";

export default function DashboardPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState<string>("");
  const [counts, setCounts] = useState({ supplies: 0, products: 0, quotes: 0 });
  const [hasSupplies, setHasSupplies] = useState<boolean>(false);
  const [hasExpensesOrLabor, setHasExpensesOrLabor] = useState<boolean>(false);
  const [hasProducts, setHasProducts] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const initialName = getUserDisplayName(user).split(" ")[0];
        setUserName(initialName);

        // 2. Traer perfil extendido de API segura
        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const data = await res.json();
            if (data.profile?.full_name) {
              setUserName(data.profile.full_name.split(" ")[0]);
            }
          }
        } catch {
          // ignore
        }

        // Cargar contadores básicos y estado de onboarding
        const [suppliesRes, productsRes, quotesRes, expensesRes, laborRes] = await Promise.all([
          supabase.from("supplies").select("id", { count: "exact", head: true }),
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("quotes").select("id", { count: "exact", head: true }),
          supabase.from("fixed_expenses").select("id", { count: "exact", head: true }),
          supabase.from("labor_settings").select("id").eq("user_id", user.id).maybeSingle(),
        ]);

        const suppliesCount = suppliesRes.count || 0;
        const productsCount = productsRes.count || 0;
        const quotesCount = quotesRes.count || 0;
        const expensesCount = expensesRes.count || 0;
        const hasLabor = Boolean(laborRes.data);

        setCounts({
          supplies: suppliesCount,
          products: productsCount,
          quotes: quotesCount,
        });

        setHasSupplies(suppliesCount > 0);
        setHasExpensesOrLabor(expensesCount > 0 || hasLabor);
        setHasProducts(productsCount > 0);
      }
    }
    loadData();
  }, [supabase]);

  return (
    <div className="w-full flex flex-col space-y-3 pb-24">
      {/* Botón / Banner de Descarga PWA */}
      <InstallPwaModal />

      {/* Guía Inicial / Onboarding: Comenzá acá */}
      <OnboardingGuide
        hasSupplies={hasSupplies}
        hasExpensesOrLabor={hasExpensesOrLabor}
        hasProducts={hasProducts}
      />

      {/* Accesos directos — 4 pasteles oficiales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

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
    </div>
  );
}
