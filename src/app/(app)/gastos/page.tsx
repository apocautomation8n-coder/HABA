"use client";

import React, { useEffect, useState, useMemo } from "react";
import { DollarSign, Clock, Plus, Trash2, Edit2, Calendar, AlertCircle, Check, Sparkles, X, Calculator, HelpCircle } from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";
import { ExpenseModal, FixedExpense } from "@/components/gastos/ExpenseModal";
import { DeleteExpenseModal } from "@/components/gastos/DeleteExpenseModal";

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

  // Gastos Fijos State & Modals
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<FixedExpense | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Handlers para Modales de Gastos Fijos
  const handleOpenCreateExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: FixedExpense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const handleOpenDeleteExpense = (expense: FixedExpense) => {
    setDeletingExpense(expense);
    setIsDeleteModalOpen(true);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleExpenseSaved = (savedExpense: FixedExpense, isEdit: boolean) => {
    if (isEdit) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === savedExpense.id ? savedExpense : e))
      );
      showToast(`Gasto "${savedExpense.name}" actualizado con éxito.`);
    } else {
      setExpenses((prev) => [savedExpense, ...prev]);
      showToast(`Gasto "${savedExpense.name}" agregado con éxito.`);
    }
  };

  const handleExpenseDeleted = (deletedId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== deletedId));
    showToast("Gasto fijo eliminado de tus costos mensuales.");
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
              ? "bg-white text-[#1F7A4C] shadow-sm"
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
              ? "bg-white text-[#1F7A4C] shadow-sm"
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
          <div className="bg-[#DCF4D7] border border-[#C3EBC0] rounded-3xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F7A4C] block">
                Total Gastos Fijos Mensuales
              </span>
              <p className="text-xs text-[#3BB578] mt-0.5">
                Normalizado a equivalente por mes
              </p>
            </div>
            <span className="text-xl font-black text-[#1F7A4C]">
              {formatCurrency(totalMonthlyExpenses)}
            </span>
          </div>

          {/* Botón Agregar Gasto */}
          <div className="flex justify-end">
            <button
              onClick={handleOpenCreateExpense}
              className="py-2 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Gasto Fijo</span>
            </button>
          </div>

          {/* Listado */}
          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Cargando gastos...</div>
          ) : expenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
              <HabaMascot size={70} />
              <div>
                <h3 className="text-sm font-bold text-neutral-700">Sin gastos fijos cargados</h3>
                <p className="text-xs text-neutral-500 max-w-[240px] mt-1">
                  Agregá luz, alquiler, internet o aplicaciones. Haba los normaliza por mes para prorratear.
                </p>
              </div>
              <button
                onClick={handleOpenCreateExpense}
                className="py-2.5 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] text-xs font-bold rounded-2xl transition flex items-center gap-1.5"
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
                  className="bg-white rounded-2xl p-3.5 border border-[#EAF0E8] shadow-sm hover:shadow-md transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-neutral-800 truncate">{expense.name}</h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                      <span className="capitalize">{expense.periodicity}</span>
                      <span>·</span>
                      <span>{formatCurrency(expense.amount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-[#1F7A4C] font-semibold block">Mensual</span>
                      <span className="text-sm font-bold text-neutral-800">
                        {formatCurrency(expense.monthly_equivalent)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditExpense(expense)}
                        className="p-1.5 text-neutral-400 hover:text-[#1F7A4C] hover:bg-[#DCF4D7] rounded-xl transition"
                        title="Editar gasto fijo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDeleteExpense(expense)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Eliminar gasto fijo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
          <div className="bg-[#DCF4D7] border border-[#C3EBC0] rounded-3xl p-4 flex items-center gap-3 shadow-sm">
            <HabaMascot size={55} className="flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#1F7A4C]">¿Cuánto vale tu hora de trabajo?</p>
              <p className="text-[11px] text-[#3BB578] mt-0.5 leading-snug">
                Definí tu sueldo deseado y tus horas reales de producción para que cada receta sume el valor exacto de tus minutos dedicados.
              </p>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
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
                  className="w-full pl-8 pr-4 py-2.5 text-sm font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
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
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
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
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
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
                <span className="text-base font-black text-[#1F7A4C]">
                  {formatCurrency(calculatedHourlyRate)}
                </span>
                <span className="text-[9px] block text-neutral-400 mt-0.5">
                  ({totalHoursPerMonth} hs/mes)
                </span>
              </div>

              <div className="bg-[#DCF4D7] p-3 rounded-2xl border border-[#C3EBC0] text-center">
                <span className="text-[10px] font-bold text-[#1F7A4C] block">
                  Valor por Minuto
                </span>
                <span className="text-base font-black text-[#1F7A4C]">
                  {formatCurrency(calculatedMinuteRate)}
                </span>
                <span className="text-[9px] block text-[#3BB578] mt-0.5">
                  Se aplica a tus recetas
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingLabor}
              className="w-full py-3 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
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

      {/* Modal Crear / Editar Gasto Fijo */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={handleExpenseSaved}
        initialExpense={editingExpense}
      />

      {/* Modal Confirmación Eliminación Kawaii */}
      <DeleteExpenseModal
        isOpen={isDeleteModalOpen}
        expense={deletingExpense}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingExpense(null);
        }}
        onSuccess={handleExpenseDeleted}
      />

      {/* Notificación flotante de confirmación (Toast Kawaii) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1F7A4C] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
