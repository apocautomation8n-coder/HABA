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

  // Guardar configuración de Mano de Obra (un registro por usuaria en Supabase)
  const handleSaveLabor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaborError(null);

    if (parsedSalary < 0) {
      setLaborError("El sueldo pretendido no puede ser negativo.");
      return;
    }
    if (daysPerMonth < 1 || daysPerMonth > 31) {
      setLaborError("Los días trabajados al mes deben estar entre 1 y 31.");
      return;
    }
    if (hoursPerDay <= 0 || hoursPerDay > 24) {
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
          working_days_per_month: daysPerMonth,
          working_hours_per_day: hoursPerDay,
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
    <div className="w-full flex flex-col space-y-4 font-body">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#2B2B2B] font-display">Gastos & Mano de Obra</h2>
          <p className="text-xs text-[#7A7A7A]">Estructura base para costear tus productos con precisión</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-100 p-1 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab("gastos")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "gastos"
              ? "bg-white text-[#1F7A4C] shadow-sm"
              : "text-[#7A7A7A] hover:text-[#2B2B2B]"
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
              : "text-[#7A7A7A] hover:text-[#2B2B2B]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Mano de Obra</span>
        </button>
      </div>

      {/* TAB 1: GASTOS FIJOS */}
      {activeTab === "gastos" && (
        <div className="space-y-4 animate-in fade-in duration-200">
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
      )}

      {/* TAB 2: MANO DE OBRA */}
      {activeTab === "mano_de_obra" && (
        <form onSubmit={handleSaveLabor} className="space-y-4 animate-in fade-in duration-200">
          {/* Card Mascota Explicativa */}
          <div className="bg-[#DCF4D7] border border-[#C3EBC0] rounded-3xl p-4 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <HabaMascot size={55} className="flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[#1F7A4C] font-display">¿Cuánto vale tu hora de trabajo?</p>
                  {lastSavedAt ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#1F7A4C] inline-flex items-center gap-1 shadow-2xs font-body">
                      <Check className="w-3 h-3 text-[#3BB578]" /> Guardado
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/80 text-[#1F7A4C] font-body">
                      Valores de referencia
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#2E9E65] mt-0.5 leading-snug font-body">
                  Definí tu sueldo deseado y tus horas reales de producción para que cada producto sume el valor exacto de tus minutos dedicados.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLaborInfo(!showLaborInfo)}
                  className="mt-2 text-[10.5px] font-bold text-[#1F7A4C] bg-white hover:bg-neutral-50 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 transition shadow-xs cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-[#3BB578]" />
                  <span>{showLaborInfo ? "Ocultar explicación" : "¿Cómo se calcula paso a paso?"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Guía Explicativa Didáctica Desplegable */}
          {showLaborInfo && (
            <div className="bg-[#F0FAF4] border border-[#C3EBC0] rounded-3xl p-4 space-y-2.5 text-xs text-[#2B2B2B] animate-in fade-in duration-200 shadow-xs">
              <div className="flex items-center justify-between font-bold text-[#1F7A4C] border-b border-[#DCF4D7] pb-1.5">
                <span className="flex items-center gap-1.5 font-display">
                  <Calculator className="w-4 h-4 text-[#3BB578]" />
                  Fórmula de Mano de Obra en Vivo:
                </span>
                <button
                  type="button"
                  onClick={() => setShowLaborInfo(false)}
                  className="text-[#7A7A7A] hover:text-[#2B2B2B] text-xs font-semibold"
                >
                  Cerrar ✕
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] leading-relaxed">
                <p>
                  1️⃣ <strong>Horas mensuales de trabajo:</strong> Multiplicás tus días trabajados por tus horas diarias dedicadas a producción:
                </p>
                <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                  {daysPerMonth} días × {hoursPerDay} hs/día = <strong>{totalHoursPerMonth} horas al mes</strong>
                </div>

                <p>
                  2️⃣ <strong>Valor por Hora:</strong> Dividís tu sueldo pretendido por el total de horas mensuales:
                </p>
                <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                  {formatCurrency(parsedSalary)} ÷ {totalHoursPerMonth} hs = <strong>{formatCurrency(calculatedHourlyRate)} por hora</strong>
                </div>

                <p>
                  3️⃣ <strong>Valor por Minuto:</strong> Dividís el valor hora entre los 60 minutos de la hora:
                </p>
                <div className="bg-white p-2 rounded-xl border border-[#DCF4D7] font-mono text-[10.5px] text-[#1F7A4C]">
                  {formatCurrency(calculatedHourlyRate)} ÷ 60 min = <strong>{formatCurrency(calculatedMinuteRate)} por minuto</strong>
                </div>

                <p className="text-[10.5px] text-[#2E9E65] pt-1.5 border-t border-[#DCF4D7] font-medium">
                  💡 <strong>¿Dónde se usa?</strong> Cuando crees un producto y cargues cuántos minutos te lleva fabricar 1 unidad, HABA multiplicará esos minutos por tu valor por minuto para asegurar tu sueldo en el precio final.
                </p>
              </div>
            </div>
          )}

          {/* Banner de error si falla la persistencia */}
          {laborError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{laborError}</span>
            </div>
          )}

          {/* Formulario */}
          <div className="bg-white p-5 rounded-3xl border border-[#EAF0E8] shadow-sm space-y-4 font-body">
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
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="350000"
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
                  value={daysPerMonth}
                  onChange={(e) => setDaysPerMonth(parseInt(e.target.value) || 1)}
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
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseFloat(e.target.value) || 1)}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                />
                <span className="text-[10px] text-[#7A7A7A]">Dedicadas a producción</span>
              </div>
            </div>

            {/* Resultado Cálculos en Vivo */}
            <div className="pt-2 border-t border-neutral-100 grid grid-cols-2 gap-3">
              <div className="bg-[#F6F7F2] p-3 rounded-2xl border border-[#EAF0E8] text-center">
                <span className="text-[10px] font-semibold text-[#7A7A7A] block">
                  Valor por Hora
                </span>
                <span className="text-base font-black text-[#1F7A4C] font-display">
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

            <button
              type="submit"
              disabled={savingLabor}
              className="w-full py-3 px-4 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-xs font-bold rounded-2xl transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              {savingLabor ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando en tu cuenta...</span>
                </>
              ) : laborSavedSuccess ? (
                <span className="flex items-center gap-1 text-white font-bold">
                  <Check className="w-4 h-4" /> ¡Configuración Guardada!
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Guardar Configuración de Mano de Obra</span>
                </span>
              )}
            </button>

            {lastSavedAt && (
              <p className="text-[10px] text-center text-neutral-400 pt-0.5">
                Última actualización: {new Date(lastSavedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} hs
              </p>
            )}
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

      {/* Modal Confirmación Eliminación */}
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
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[99999] bg-[#1F7A4C] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
