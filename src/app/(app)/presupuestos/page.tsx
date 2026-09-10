"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Receipt, Plus, Search, Sparkles } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";

export default function PresupuestosPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Presupuestos</h2>
          <p className="text-xs text-neutral-500">Cotizaciones profesionales y PDF para clientes</p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="p-2.5 bg-[#3b7c42] hover:bg-[#326b38] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo</span>
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o número..."
          className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none shadow-sm transition"
        />
      </div>

      {/* Estado vacío */}
      <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
        <HabaMascot size={80} />
        <div>
          <h3 className="text-sm font-bold text-neutral-700">No hay presupuestos emitidos</h3>
          <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
            Generá presupuestos congelando precios para enviarlos por WhatsApp o descargarlos en PDF.
          </p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="mt-2 py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-2xl transition flex items-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" />
          <span>Armar primer presupuesto</span>
        </Link>
      </div>
    </div>
  );
}
