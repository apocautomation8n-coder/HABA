"use client";

import React, { useEffect, useState, useMemo } from "react";
import { DollarSign, Clock, Plus, Trash2, Calendar, AlertCircle, Check, Sparkles, X, Calculator, HelpCircle } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";

interface FixedExpense {
  id?: string;
  name: string;
  amount: number;
  periodicity: "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";
  monthly_equivalent: number;
  created_at?: string;
}

interface LaborSettings {
  desired_monthly_salary: number;
  working_days_per_month: number;
  working_hours_per_day: number;
  hourly_rate: number;
  minute_rate: number;
}

export default function GastosPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"gastos" | "mano_de_obra">("gastos");
  const [loading, setLoading] = useState(true);

  // Gastos Fijos State
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number | string>("");
  const [expensePeriodicity, setExpensePeriodicity] = useState<"mensual" | "bimestral" | "trimestral" | "semestral" | "anual">("mensual");
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Mano de Obra State
  const [salary, setSalary] = useState<number | string>(350000);
  const [daysPerMonth, setDaysPerMonth] = useState<number>(20);
  const [hoursPerDay, setHoursPerDay] = useState<number>(6);
  const [savingLabor, setSavingLabor] = useState(false);
  const [laborSavedSuccess, setLaborSavedSuccess] = useState(false);

  // Cargar datos
  const loadData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Cargar gastos fijos
        const { data: expData } = await supabase
          .from("fixed_expenses")
          .select("*")
          .order("created_at", { ascending: false });
        if (expData) setExpenses(expData as FixedExpense[]);

        // Cargar configuración de mano de obra
        const { data: laborData } = await supabase
          .from("labor_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (laborData) {
          setSalary(laborData.desired_monthly_salary || 0);
          setDaysPerMonth(laborData.working_days_per_month || 20);
          setHoursPerDay(laborData.working_hours_per_day || 6);
        }
      }
    } catch (err) {
      console.error("Error loading gastos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Total gastos mensuales
  const totalMonthlyExpenses = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + Number(curr.monthly_equivalent || 0), 0);
  }, [expenses]);

  // Cálculo reactivo de Mano de Obra
  const parsedSalary = typeof salary === "number" ? salary : parseFloat(salary) || 0;
  const totalHoursPerMonth = (daysPerMonth || 1) * (hoursPerDay || 1);
  const calculatedHourlyRate = totalHoursPerMonth > 0 ? parsedSalary / totalHoursPerMonth : 0;
  const calculatedMinuteRate = calculatedHourlyRate / 60;

  // Manejo de guardado de gasto fijo
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);

    const amountNum = typeof expenseAmount === "number" ? expenseAmount : parseFloat(expenseAmount) || 0;
    if (!expenseName.trim() || amountNum <= 0) {
      setExpenseError("Ingresá un nombre y monto válido mayor a 0");
      return;
    }

    // Factor divisor a mes
    const dividers = {
      mensual: 1,
      bimestral: 2,
      trimestral: 3,
      semestral: 6,
      anual: 12,
    };
    const monthlyEq = amountNum / dividers[expensePeriodicity];

    try {
      setSavingExpense(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase.from("fixed_expenses").insert({
        user_id: user.id,
        name: expenseName.trim(),
        amount: amountNum,
        periodicity: expensePeriodicity,
        monthly_equivalent: monthlyEq,
      }).select().single();

      if (error) throw error;

      if (data) {
        setExpenses([data as FixedExpense, ...expenses]);
      }

      setIsExpenseModalOpen(false);
      setExpenseName("");
      setExpenseAmount("");
      setExpensePeriodicity("mensual");
    } catch (err: any) {
      setExpenseError(err.message || "Error al guardar el gasto");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id?: string) => {
    if (!id) return;
    if (!confirm("¿Eliminar este gasto fijo?")) return;

    try {
      const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
      if (!error) {
        setExpenses(expenses.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Guardar configuración de Mano de Obra
  const handleSaveLabor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLabor(true);
    setLaborSavedSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("labor_settings").upsert({
        user_id: user.id,
        desired_monthly_salary: parsedSalary,
        working_days_per_month: daysPerMonth,
        working_hours_per_day: hoursPerDay,
        hourly_rate: calculatedHourlyRate,
        minute_rate: calculatedMinuteRate,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        setLaborSavedSuccess(true);
        setTimeout(() => setLaborSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLabor(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Gastos & Mano de Obra</h2>
          <p className="text-xs text-neutral-500">Estructura base para costear tus recetas con precisión</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab("gastos")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "gastos"
              ? "bg-white text-[#306236] shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Gastos Fijos ({expenses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("mano_de_obra")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "mano_de_obra"
              ? "bg-white text-[#306236] shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Mano de Obra</span>
        </button>
      </div>

      {/* CONTENIDO TAB 1: GASTOS FIJOS */}
      {activeTab === "gastos" && (
        <div className="space-y-3">
          {/* Card Resumen Total */}
          <div className="bg-[#e5f2e6] border border-[#cce5ce] rounded-3xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#306236] block">
                Total Gastos Fijos Mensuales
              </span>
              <p className="text-xs text-[#3b7c42] mt-0.5">
                Normalizado a equivalente por mes
              </p>
            </div>
            <span className="text-xl font-black text-[#244228]">
              {formatCurrency(totalMonthlyExpenses)}
            </span>
          </div>

          {/* Botón Agregar Gasto */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="py-2 px-3.5 bg-[#3b7c42] hover:bg-[#326b38] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Gasto Fijo</span>
            </button>
          </div>

          {/* Listado */}
          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Cargando gastos...</div>
          ) : expenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#eef2eb] shadow-sm flex flex-col items-center text-center space-y-3">
              <HabaMascot size={70} />
              <div>
                <h3 className="text-sm font-bold text-neutral-700">Sin gastos fijos cargados</h3>
                <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
                  Agregá luz, alquiler, internet o aplicaciones. Haba los normaliza por mes para prorratear.
                </p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="py-2.5 px-4 bg-[#e5f2e6] hover:bg-[#cce5ce] text-[#306236] text-xs font-bold rounded-2xl transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar mi primer gasto fijo</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="bg-white rounded-2xl p-3.5 border border-[#eef2eb] shadow-sm flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-neutral-800 truncate">{expense.name}</h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                      <span className="capitalize">{expense.periodicity}</span>
                      <span>·</span>
                      <span>{formatCurrency(expense.amount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-[#306236] font-semibold block">Mensual</span>
                      <span className="text-sm font-bold text-neutral-800">
                        {formatCurrency(expense.monthly_equivalent)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB 2: CALCULADORA DE MANO DE OBRA */}
      {activeTab === "mano_de_obra" && (
        <form onSubmit={handleSaveLabor} className="space-y-4">
          {/* Card Mascota Explicativa */}
          <div className="bg-[#e5f2e6] border border-[#cce5ce] rounded-3xl p-4 flex items-center gap-3 shadow-sm">
            <HabaMascot size={55} className="flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#2a4f2f]">¿Cuánto vale tu hora de trabajo?</p>
              <p className="text-[11px] text-[#3b7c42] mt-0.5 leading-snug">
                Definí tu sueldo deseado y tus horas reales de producción para que cada receta sume el valor exacto de tus minutos dedicados.
              </p>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-white p-5 rounded-3xl border border-[#eef2eb] shadow-sm space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">
                Sueldo Pretendido Mensual ($)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 font-semibold text-sm">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="350000"
                  required
                  className="w-full pl-8 pr-4 py-2.5 text-sm font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
                />
              </div>
              <p className="text-[10px] text-neutral-400">
                Lo que querés ganar de bolsillo por mes trabajando en tu emprendimiento.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Días al Mes</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={daysPerMonth}
                  onChange={(e) => setDaysPerMonth(parseInt(e.target.value) || 1)}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
                />
                <span className="text-[10px] text-neutral-400">Habitual: 20 a 24 días</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Horas por Día</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseFloat(e.target.value) || 1)}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
                />
                <span className="text-[10px] text-neutral-400">Dedicadas a producción</span>
              </div>
            </div>

            {/* Resultado Cálculos en Vivo */}
            <div className="pt-2 border-t border-neutral-100 grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 text-center">
                <span className="text-[10px] font-semibold text-neutral-500 block">
                  Valor por Hora
                </span>
                <span className="text-base font-black text-[#244228]">
                  {formatCurrency(calculatedHourlyRate)}
                </span>
                <span className="text-[9px] block text-neutral-400 mt-0.5">
                  ({totalHoursPerMonth} hs/mes)
                </span>
              </div>

              <div className="bg-[#e5f2e6] p-3 rounded-2xl border border-[#cce5ce] text-center">
                <span className="text-[10px] font-bold text-[#306236] block">
                  Valor por Minuto
                </span>
                <span className="text-base font-black text-[#244228]">
                  {formatCurrency(calculatedMinuteRate)}
                </span>
                <span className="text-[9px] block text-[#3b7c42] mt-0.5">
                  Se aplica a tus recetas
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingLabor}
              className="w-full py-3 px-4 bg-[#3b7c42] hover:bg-[#326b38] text-white text-xs font-bold rounded-2xl transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              {savingLabor ? (
                <span>Guardando...</span>
              ) : laborSavedSuccess ? (
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4" /> ¡Configuración Guardada!
                </span>
              ) : (
                <span>Guardar Configuración de Mano de Obra</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Modal Agregar Gasto Fijo */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#eef2eb] animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-800">Nuevo Gasto Fijo</h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Nombre del Gasto</label>
                <input
                  type="text"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  placeholder="Ej: Alquiler, Luz taller, Canva, Internet..."
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Monto ($)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Periodicidad</label>
                <select
                  value={expensePeriodicity}
                  onChange={(e) => setExpensePeriodicity(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#4f9856] outline-none"
                >
                  <option value="mensual">Mensual (1 mes)</option>
                  <option value="bimestral">Bimestral (cada 2 meses)</option>
                  <option value="trimestral">Trimestral (cada 3 meses)</option>
                  <option value="semestral">Semestral (cada 6 meses)</option>
                  <option value="anual">Anual (cada 12 meses)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 py-2 px-3 bg-[#3b7c42] hover:bg-[#326b38] text-white rounded-2xl text-xs font-bold shadow-sm"
                >
                  {savingExpense ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
