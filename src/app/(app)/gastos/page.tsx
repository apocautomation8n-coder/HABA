"use client";

import React, { useState } from "react";
import { DollarSign, Clock, Plus, Sparkles } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";

export default function GastosPage() {
  const [activeTab, setActiveTab] = useState<"gastos" | "mano_de_obra">("gastos");

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Encabezado del Módulo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Gastos & Tiempo</h2>
          <p className="text-xs text-neutral-500">Gastos fijos mensuales y valor hora de trabajo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab("gastos")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "gastos"
              ? "bg-white text-[#306236] shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Gastos Fijos</span>
        </button>
        <button
          onClick={() => setActiveTab("mano_de_obra")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "mano_de_obra"
              ? "bg-white text-[#306236] shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Mano de Obra</span>
        </button>
      </div>

      {/* Contenido según Tab */}
      {activeTab === "gastos" ? (
        <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">Sin gastos fijos cargados</h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              Agregá alquiler, luz, internet o herramientas. Se normalizan mensualmente para prorratear en tus productos.
            </p>
          </div>
          <button
            onClick={() => alert("Próximo paso: Formulario de Gasto Fijo")}
            className="mt-2 py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-2xl transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar gasto fijo</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
          <HabaMascot size={80} />
          <div>
            <h3 className="text-sm font-bold text-neutral-700">Calculadora de Mano de Obra</h3>
            <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
              Definí tu sueldo pretendido y tus horas dedicadas para conocer el valor exacto de cada minuto de trabajo.
            </p>
          </div>
          <button
            onClick={() => alert("Próximo paso: Configurar Mano de Obra")}
            className="mt-2 py-2.5 px-4 bg-[#e5f2e6] hover:bg-[#cce5ce] text-[#306236] text-xs font-bold rounded-2xl transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Configurar mi valor hora</span>
          </button>
        </div>
      )}
    </div>
  );
}
