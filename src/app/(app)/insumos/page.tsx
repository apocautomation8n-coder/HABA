"use client";

import React, { useState } from "react";
import { Boxes, Plus, Search, Sparkles } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";

export default function InsumosPage() {
  const [filter, setFilter] = useState<"todos" | "materia_prima" | "packaging">("todos");
  const [search, setSearch] = useState("");

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Mis Insumos</h2>
          <p className="text-xs text-neutral-500">Materia prima y packaging con precios de reposición</p>
        </div>
        <button
          onClick={() => alert("Próximo paso: Formulario de Alta de Insumo")}
          className="p-2.5 bg-[#3b7c42] hover:bg-[#326b38] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar</span>
        </button>
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
          placeholder="Buscar harina, tela, caja, cinta..."
          className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#4f9856] focus:ring-2 focus:ring-[#e5f2e6] outline-none shadow-sm transition"
        />
      </div>

      {/* Filtros por pestaña */}
      <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
        {(
          [
            { key: "todos", label: "Todos" },
            { key: "materia_prima", label: "Materia Prima" },
            { key: "packaging", label: "Packaging" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
              filter === tab.key
                ? "bg-white text-[#306236] shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Estado vacío amigable */}
      <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
        <HabaMascot size={80} />
        <div>
          <h3 className="text-sm font-bold text-neutral-700">Aún no tenés insumos cargados</h3>
          <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
            Cargá los materiales que comprás con su precio actual de reposición para calcular tus recetas.
          </p>
        </div>
        <button
          onClick={() => alert("Próximo paso: Formulario de Alta de Insumo")}
          className="mt-2 py-2.5 px-4 bg-[#e5f2e6] hover:bg-[#cce5ce] text-[#306236] text-xs font-bold rounded-2xl transition flex items-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" />
          <span>Cargar mi primer insumo</span>
        </button>
      </div>
    </div>
  );
}
