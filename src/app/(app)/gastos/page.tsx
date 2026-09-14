"use client";
import React, { useEffect, useState, useMemo } from "react";
import { DollarSign, Clock, Plus, Trash2, Edit2, Calendar, AlertCircle, Check, Sparkles, X, Calculator, HelpCircle, Loader2, Info } from "lucide-react";
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
  const [daysPerMonth, setDaysPerMonth] = useState<number | string>(20);
  const [hoursPerDay, setHoursPerDay] = useState<number | string>(6);
  const [savingLabor, setSavingLabor] = useState(false);
  const [laborSavedSuccess, setLaborSavedSuccess] = useState(false);
  const [laborError, setLaborError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showLaborInfo, setShowLaborInfo] = useState(false);

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

        // Cargar configuración de mano de obra (un registro por usuaria)
        const { data: laborData } = await supabase
          .from("labor_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (laborData) {
          setSalary(laborData.desired_monthly_salary ?? 350000);
          setDaysPerMonth(laborData.working_days_per_month ?? 20);
          setHoursPerDay(laborData.working_hours_per_day ?? 6);
          setLastSavedAt(laborData.updated_at || null);
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
  const parsedSalary = typeof salary === "number" ? salary : parseFloat(String(salary)) || 0;
  const numDays = typeof daysPerMonth === "number" ? daysPerMonth : parseFloat(String(daysPerMonth)) || 0;
  const numHours = typeof hoursPerDay === "number" ? hoursPerDay : parseFloat(String(hoursPerDay)) || 0;
  const totalHoursPerMonth = numDays * numHours;
  const objetivoMensual = parsedSalary + totalMonthlyExpenses;
  const calculatedHourlyRate = totalHoursPerMonth > 0 ? objetivoMensual / totalHoursPerMonth : 0;
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

  // Guardar configuración de Mano de Obra (un registro por usuaria en Supabase)
  const handleSaveLabor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaborError(null);

    const numDays = typeof daysPerMonth === "number" ? daysPerMonth : parseFloat(String(daysPerMonth)) || 0;
    const numHours = typeof hoursPerDay === "number" ? hoursPerDay : parseFloat(String(hoursPerDay)) || 0;

    if (parsedSalary < 0) {
      setLaborError("El sueldo pretendido no puede ser negativo.");
      return;
    }
    if (numDays < 1 || numDays > 31) {
      setLaborError("Los días trabajados al mes deben estar entre 1 y 31.");
      return;
    }
    if (numHours <= 0 || numHours > 24) {
      setLaborError("Las horas diarias de producción deben ser entre 1 y 24.");
      return;
    }

    try {
      setSavingLabor(true);
      setLaborSavedSuccess(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No hay una sesión de usuaria activa.");
      }

      const now = new Date().toISOString();

      const { error: upsertError } = await supabase.from("labor_settings").upsert(
        {
          user_id: user.id,
          desired_monthly_salary: parsedSalary,
          working_days_per_month: numDays,
          working_hours_per_day: numHours,
          hourly_rate: calculatedHourlyRate,
          minute_rate: calculatedMinuteRate,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

      if (upsertError) throw upsertError;

      setLastSavedAt(now);
      setLaborSavedSuccess(true);
      showToast("Configuración de mano de obra guardada con éxito.");
      setTimeout(() => setLaborSavedSuccess(false), 3500);
    } catch (err: any) {
      console.error("Error al guardar mano de obra:", err);
      setLaborError(err.message || "Error al guardar la configuración de mano de obra.");
    } finally {
      setSavingLabor(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6 font-body pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#2B2B2B] font-display">Gastos & Mano de Obra</h2>
          <p className="text-xs text-[#7A7A7A]">Tu objetivo mensual determina cuánto vale cada minuto de tu trabajo</p>
        </div>
      </div>

      {/* Section 1: Gastos Operativos Mensuales */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[#2B2B2B] flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#1F7A4C]" />
          Gastos Operativos Mensuales
        </h3>
        
        {/* Total Mensual */}
        <div className="bg-white p-4 rounded-3xl border border-[#EAF0E8] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#7A7A7A] block">
              Total Gastos Fijos Mensuales
            </span>
            <span className="text-2xl font-black text-[#2B2B2B] mt-0.5 block font-display">
              {formatCurrency(totalMonthlyExpenses)}
            </span>
          </div>
          <button
            onClick={handleOpenCreateExpense}
            className="py-2.5 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Gasto</span>
          </button>
        </div>

        {/* Listado */}
        {loading ? (
          <div className="py-12 text-center text-xs text-[#7A7A7A]">Cargando gastos...</div>
        ) : expenses.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] shadow-sm flex flex-col items-center text-center space-y-3">
            <HabaMascot size={70} />
            <div>
              <h3 className="text-sm font-bold text-[#2B2B2B] font-display">Sin gastos fijos cargados</h3>
              <p className="text-xs text-[#7A7A7A] max-w-[240px] mt-1 font-body">
                Agregá luz, alquiler, internet o aplicaciones. HABA los normaliza por mes para prorratear en tus productos.
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
                className="bg-white rounded-2xl p-3.5 border border-[#EAF0E8] shadow-xs hover:shadow-sm transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center font-bold text-xs">
                    {expense.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2B2B2B]">{expense.name}</h4>
                    <p className="text-[10px] text-[#7A7A7A] capitalize">
                      {expense.periodicity} · {formatCurrency(expense.amount)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#1F7A4C] block">
                      {formatCurrency(expense.monthly_equivalent)}
                    </span>
                    <span className="text-[9px] text-[#7A7A7A] block">/ mes</span>
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

      <form onSubmit={handleSaveLabor} className="space-y-6">
        
        {/* Section 2: Tu Sueldo Pretendido */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#2B2B2B] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#1F7A4C]" />
            Tu Sueldo Pretendido
          </h3>
          
          <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#2B2B2B]">
                Sueldo Pretendido Mensual ($)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#7A7A7A] font-semibold text-sm">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={salary === 0 ? "" : salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full pl-8 pr-4 py-2.5 text-sm font-bold text-[#2B2B2B] bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
                />
              </div>
              <p className="text-[10px] text-[#7A7A7A]">
                Lo que querés ganar de bolsillo por mes trabajando en tu emprendimiento.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#2B2B2B]">Días al Mes</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={daysPerMonth === 0 ? "" : daysPerMonth}
                  onChange={(e) => setDaysPerMonth(e.target.value)}
                  placeholder="20"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                />
                <span className="text-[10px] text-[#7A7A7A]">Habitual: 20 a 24 días</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#2B2B2B]">Horas por Día</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={hoursPerDay === 0 ? "" : hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                  placeholder="6"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                />
                <span className="text-[10px] text-[#7A7A7A]">Dedicadas a producción</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Objetivo Mensual */}
        <div className="space-y-2">
          <div className="bg-[#DCF4D7] p-5 rounded-3xl border border-[#C3EBC0] shadow-sm">
            <h3 className="text-sm font-bold text-[#1F7A4C] mb-3 font-display">Objetivo Mensual</h3>
            
            <div className="space-y-2 text-xs font-medium text-[#2B2B2B]">
              <div className="flex justify-between items-center">
                <span>Gastos Operativos:</span>
                <span>{formatCurrency(totalMonthlyExpenses)}/mes</span>
              </div>
              <div className="flex justify-between items-center">
                <span>+ Sueldo Pretendido:</span>
                <span>{formatCurrency(parsedSalary)}/mes</span>
              </div>
              <div className="pt-2 mt-2 border-t border-[#C3EBC0] flex justify-between items-center font-bold text-sm text-[#1F7A4C]">
                <span>= Objetivo Mensual:</span>
                <span>{formatCurrency(objetivoMensual)}/mes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Valor del Minuto */}
        <div className="space-y-2">
          <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm">
            <h3 className="text-sm font-bold text-[#2B2B2B] mb-1 font-display">Valor del Minuto</h3>
            <p className="text-xs text-[#7A7A7A] mb-4">
              Cada minuto que dedicás a producir ya incluye proporcionalmente tus gastos operativos y tu sueldo pretendido.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F6F7F2] p-3 rounded-2xl border border-[#EAF0E8] text-center">
                <span className="text-[10px] font-semibold text-[#7A7A7A] block">
                  Valor por Hora
                </span>
                <span className="text-base font-black text-[#2B2B2B] font-display">
                  {formatCurrency(calculatedHourlyRate)}
                </span>
                <span className="text-[9px] block text-[#7A7A7A] mt-0.5">
                  ({totalHoursPerMonth} hs/mes)
                </span>
              </div>

              <div className="bg-[#DCF4D7] p-3 rounded-2xl border border-[#C3EBC0] text-center">
                <span className="text-[10px] font-bold text-[#1F7A4C] block">
                  Valor por Minuto
                </span>
                <span className="text-base font-black text-[#1F7A4C] font-display">
                  {formatCurrency(calculatedMinuteRate)}
                </span>
                <span className="text-[9px] block text-[#2E9E65] mt-0.5 font-medium">
                  Se aplica a tus productos
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Toggle & Explanatory text */}
        <div className="flex flex-col items-center pt-2">
          <button
            type="button"
            onClick={() => setShowLaborInfo(!showLaborInfo)}
            className="text-[11px] font-bold text-[#1F7A4C] hover:bg-neutral-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showLaborInfo ? "Ocultar explicación de la fórmula" : "¿Cómo se calcula esto?"}</span>
          </button>
          
          {showLaborInfo && (
            <div className="bg-[#F0FAF4] border border-[#C3EBC0] rounded-3xl p-4 space-y-2.5 text-xs text-[#2B2B2B] animate-in fade-in duration-200 shadow-xs mt-3 w-full">
              <div className="flex items-center justify-between font-bold text-[#1F7A4C] border-b border-[#DCF4D7] pb-1.5">
                <span className="flex items-center gap-1.5 font-display">
                  <Calculator className="w-4 h-4 text-[#3BB578]" />
                  Fórmula de Costo Integral:
                </span>
                <button
                  type="button"
                  onClick={() => setShowLaborInfo(false)}
                  className="text-[#7A7A7A] hover:text-[#2B2B2B] text-xs font-semibold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] leading-relaxed">
                <p>
                  1️⃣ <strong>Objetivo Mensual:</strong> Sumamos tus gastos operativos y tu sueldo:
                </p>
                <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                  Gastos + Sueldo = <strong>{formatCurrency(objetivoMensual)} al mes</strong>
                </div>

                <p>
                  2️⃣ <strong>Valor por Hora:</strong> Dividís tu objetivo mensual por el total de horas que trabajás:
                </p>
                <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                  {formatCurrency(objetivoMensual)} ÷ {totalHoursPerMonth} hs = <strong>{formatCurrency(calculatedHourlyRate)} por hora</strong>
                </div>

                <p>
                  3️⃣ <strong>Valor por Minuto:</strong> Dividís el valor hora entre los 60 minutos de la hora:
                </p>
                <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                  {formatCurrency(calculatedHourlyRate)} ÷ 60 min = <strong>{formatCurrency(calculatedMinuteRate)} por minuto</strong>
                </div>

                <p className="text-[10.5px] text-[#2E9E65] pt-1.5 border-t border-[#DCF4D7] font-medium">
                  💡 <strong>¿Dónde se usa?</strong> Al crear un producto, los minutos de producción se multiplican por este valor, asegurando así cubrir tus gastos y tu sueldo.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Banner de error si falla la persistencia */}
        {laborError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{laborError}</span>
          </div>
        )}

        {/* Single Save Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={savingLabor}
            className="w-full py-3.5 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-sm font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
          >
            {savingLabor ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Guardando configuración...</span>
              </>
            ) : laborSavedSuccess ? (
              <span className="flex items-center gap-1 text-white font-bold">
                <Check className="w-5 h-5" /> ¡Guardado con éxito!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-5 h-5" />
                <span>Guardar Configuración Integral</span>
              </span>
            )}
          </button>
          
          {lastSavedAt && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-neutral-400">
              <Check className="w-3 h-3 text-[#3BB578]" />
              <span>
                Última actualización: {new Date(lastSavedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} hs
              </span>
            </div>
          )}
        </div>
      </form>

      {/* Modals & Toasts */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={handleExpenseSaved}
        initialExpense={editingExpense}
      />

      <DeleteExpenseModal
        isOpen={isDeleteModalOpen}
        expense={deletingExpense}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingExpense(null);
        }}
        onSuccess={handleExpenseDeleted}
      />

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[99999] bg-[#1F7A4C] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
