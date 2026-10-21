"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  UserPlus,
  Power,
  Trash2,
  ArrowLeft,
  Search,
  Check,
  AlertCircle,
  KeyRound,
  Edit2,
  X,
  Calendar,
  Clock,
  Store,
  Filter,
  Hash,
  Sparkles,
  RefreshCw,
  Phone,
  MessageCircle,
  History,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  RotateCcw,
  FilterX,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { isRealUserAvatar } from "@/components/ProfileAvatar";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";
import {
  PlanType,
  AccountStatus,
  PLAN_NAMES,
  ACCOUNT_STATUS_NAMES,
  getPlanStatusInfo,
  formatDateDisplay,
  calculatePlanEndDate,
} from "@/lib/plan-helpers";
import { matchesSearch } from "@/lib/search";

/**
 * Normaliza y construye el link directo a WhatsApp para comunicarse con una usuaria
 */
function buildWhatsAppUrl(rawPhone?: string | null, userName?: string): string {
  if (!rawPhone) return "#";
  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "#";
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (!digits.startsWith("54")) {
    if (digits.length === 10) digits = `549${digits}`;
    else digits = `54${digits}`;
  } else if (digits.startsWith("54") && !digits.startsWith("549") && digits.length === 12) {
    digits = `549${digits.substring(2)}`;
  }
  const firstName = userName ? userName.split(" ")[0] : "";
  const greeting = firstName ? `Hola ${firstName}! Te escribo desde HABA.` : "Hola! Te escribo desde HABA.";
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  business_name?: string;
  account_number?: string;
  role: "admin" | "user";
  status: "active" | "suspended";
  created_at: string;
  plan_type?: PlanType;
  plan_start_date?: string;
  plan_end_date?: string;
  account_status?: AccountStatus;
  avatar_url?: string | null;
  phone?: string;
  is_new?: boolean;
  registration_source?: string;
  mp_status?: string | null;
  mp_preapproval_id?: string | null;
}

export type FilterPlan = "todos" | "prueba" | "mensual" | "anual";
export type FilterVigencia = "todas" | "vigente" | "proximo" | "vencido";
export type FilterStatus = "todos" | "active" | "suspended";

type QuickFilter = "todos" | "activos" | "proximos" | "vencidos" | "desactivados";

/**
 * Exporta el listado de usuarias a un archivo CSV formateado con UTF-8 BOM
 * para visualización nativa y correcta de acentos y caracteres especiales en Microsoft Excel.
 */
function exportUsersToCSV(usersToExport: UserProfile[]): void {
  if (!usersToExport || usersToExport.length === 0) return;

  const headers = [
    "N° Cuenta",
    "Nombre / Emprendimiento",
    "Email",
    "Plan",
    "Estado Cuenta",
    "Fecha Inicio",
    "Fecha Vencimiento",
    "Vigencia",
  ];

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = usersToExport.map((u) => {
    // 1. N° Cuenta
    const accountNumber = u.account_number || "-";

    // 2. Nombre / Emprendimiento
    const fullName = (u.full_name || "").trim();
    const businessName = (u.business_name || "").trim();
    let nameAndBusiness = fullName;
    if (businessName) {
      nameAndBusiness = fullName ? `${fullName} (${businessName})` : businessName;
    }
    if (!nameAndBusiness) nameAndBusiness = u.email;

    // 3. Email
    const email = u.email || "";

    // 4. Plan
    const planName = PLAN_NAMES[u.plan_type || "prueba"] || u.plan_type || "Plan Prueba";

    // 5. Estado Cuenta
    const effectiveAccountStatus =
      u.account_status || (u.status === "suspended" ? "suspended" : "active");
    const accountStatusName =
      ACCOUNT_STATUS_NAMES[effectiveAccountStatus] ||
      (effectiveAccountStatus === "active" ? "Activa" : "Suspendida");

    // 6. Fecha Inicio (DD/MM/AAAA)
    const startDate = u.plan_start_date || u.created_at?.split("T")[0] || "";
    const startDateFormatted = formatDateDisplay(startDate);

    // 7. Fecha Vencimiento (DD/MM/AAAA)
    const endDateFormatted = formatDateDisplay(u.plan_end_date);

    // 8. Vigencia
    const info = getPlanStatusInfo(u.plan_end_date);
    const vigenciaText = !u.plan_end_date
      ? "Sin fecha"
      : `${info.label} (${info.rowText})`;

    return [
      escapeCSV(accountNumber),
      escapeCSV(nameAndBusiness),
      escapeCSV(email),
      escapeCSV(planName),
      escapeCSV(accountStatusName),
      escapeCSV(startDateFormatted),
      escapeCSV(endDateFormatted),
      escapeCSV(vigenciaText),
    ];
  });

  // Agregar el BOM UTF-8 (\uFEFF) e instrucción explícita sep=; para forzar a Microsoft Excel
  // a reconocer el delimitador de punto y coma en cualquier versión o configuración de Windows
  const BOM = "\uFEFF";
  const csvContent =
    BOM +
    "sep=;\r\n" +
    [headers.map(escapeCSV).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  const hours = String(today.getHours()).padStart(2, "0");
  const minutes = String(today.getMinutes()).padStart(2, "0");
  const fileName = `usuarios_haba_${day}_${month}_${year}_${hours}${minutes}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [filterPlan, setFilterPlan] = useState<FilterPlan>("todos");
  const [filterVigencia, setFilterVigencia] = useState<FilterVigencia>("todas");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("todos");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [expandedHistoryUserId, setExpandedHistoryUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal para dar de alta nueva usuaria
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPlanType, setNewPlanType] = useState<PlanType>("prueba");
  const [newPlanStartDate, setNewPlanStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newPlanEndDate, setNewPlanEndDate] = useState(
    calculatePlanEndDate(new Date().toISOString().split("T")[0], "prueba")
  );
  const [newAccountStatus, setNewAccountStatus] = useState<AccountStatus>("active");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal para cambiar contraseña
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Modal para editar datos y plan de usuaria
  const [editModalUser, setEditModalUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPlanType, setEditPlanType] = useState<PlanType>("prueba");
  const [editPlanStartDate, setEditPlanStartDate] = useState("");
  const [editPlanEndDate, setEditPlanEndDate] = useState("");
  const [editAccountStatus, setEditAccountStatus] = useState<AccountStatus>("active");
  const [editingUserLoading, setEditingUserLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Oscurecer la barra de estado superior nativa de iOS al abrir cualquier modal en admin
  useModalThemeColor(
    isCreateModalOpen || Boolean(resetModalUser) || Boolean(editModalUser),
    "#000000"
  );

  // Bloquear scroll de fondo para evitar rebote elástico en móviles
  useEffect(() => {
    const isAnyModalOpen =
      isCreateModalOpen || Boolean(resetModalUser) || Boolean(editModalUser);
    if (!isAnyModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isCreateModalOpen, resetModalUser, editModalUser]);

  // Cargar usuarias del sistema
  const loadUsers = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Validar rol de admin: Únicamente Gio tiene acceso a este panel
      const hasAdmin = checkIsAdmin(user);

      if (!hasAdmin) {
        setIsAdmin(false);
        setLoading(false);
        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);

      // Cargar perfiles y planes mediante API segura
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Cache-Control": "no-cache" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/admin/users", {
        cache: "no-store",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setUsers(data.users as UserProfile[]);
        }
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Alternar estado activo / suspendido (apagar/encender)
  const toggleUserActive = async (targetUser: UserProfile) => {
    const currentEffectiveStatus =
      targetUser.account_status ||
      (targetUser.status === "suspended" ? "suspended" : "active");
    const isCurrentlyActive = currentEffectiveStatus === "active";
    const nextAccountStatus: AccountStatus = isCurrentlyActive
      ? "suspended"
      : "active";
    const actionName = isCurrentlyActive ? "suspender / apagar" : "activar";

    const confirm = window.confirm(
      `¿Estás segura de ${actionName} la cuenta de "${
        targetUser.full_name || targetUser.email
      }"?`
    );
    if (!confirm) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          accountStatus: nextAccountStatus,
        }),
      });

      const resJson = await res.json();
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id
              ? {
                  ...u,
                  account_status: nextAccountStatus,
                  status: nextAccountStatus === "active" ? "active" : "suspended",
                }
              : u
          )
        );
      } else {
        alert("Error al actualizar estado: " + (resJson.error || "No se pudo actualizar"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) return;
    try {
      exportUsersToCSV(filteredUsers);
      setToastMessage("Listado exportado con éxito");
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (err: any) {
      alert("Error al exportar CSV: " + err.message);
    }
  };

  const syncUserMercadoPago = async (targetUser: UserProfile) => {
    try {
      setSyncingUserId(targetUser.id);
      const res = await fetch(
        `/api/mercadopago/sync?userId=${targetUser.id}&email=${encodeURIComponent(
          targetUser.email || ""
        )}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.synced) {
        alert(
          `¡Suscripción de ${targetUser.full_name || targetUser.email} sincronizada con éxito!\nPlan: ${
            data.plan_type
          }\nFecha de fin: ${formatDateDisplay(data.plan_end_date)}`
        );
        await loadUsers();
      } else {
        alert(
          data.error ||
            "No se detectó un cobro o suscripción autorizada en Mercado Pago para esta usuaria todavía."
        );
      }
    } catch (err: any) {
      alert("Error al sincronizar con Mercado Pago: " + err.message);
    } finally {
      setSyncingUserId(null);
    }
  };

  // Eliminar usuaria definitivamente
  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (targetUser.role === "admin") {
      alert("No se puede eliminar la cuenta principal de SuperAdmin.");
      return;
    }

    const confirm = window.confirm(
      `¿ELIMINAR DEFINITIVAMENTE a "${
        targetUser.full_name || targetUser.email
      }"?\n\nEsta acción borrará permanentemente su cuenta y todos sus productos, insumos y presupuestos.`
    );
    if (!confirm) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id }),
      });

      const resJson = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      } else {
        alert("Error al eliminar: " + (resJson.error || "No se pudo eliminar"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Crear nueva usuaria con plan
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreatingUser(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          fullName: newFullName.trim(),
          businessName: newBusinessName.trim(),
          phone: newPhone.trim(),
          planType: newPlanType,
          planStartDate: newPlanStartDate,
          planEndDate: newPlanEndDate,
          accountStatus: newAccountStatus,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Error al crear usuaria");
      }

      await loadUsers();
      setIsCreateModalOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewBusinessName("");
      setNewPhone("");
      setNewPlanType("prueba");
      const today = new Date().toISOString().split("T")[0];
      setNewPlanStartDate(today);
      setNewPlanEndDate(calculatePlanEndDate(today, "prueba"));
      setNewAccountStatus("active");
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // Guardar nueva contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetError(null);
    setResettingPassword(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetModalUser.id,
          password: resetPassword,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "No se pudo cambiar la contraseña");
      }

      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        setResetModalUser(null);
        setResetPassword("");
      }, 1500);
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResettingPassword(false);
    }
  };

  // Guardar cambios de datos y plan de usuaria
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;
    setEditError(null);
    setEditingUserLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editModalUser.id,
          fullName: editFullName.trim(),
          businessName: editBusinessName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          planType: editPlanType,
          planStartDate: editPlanStartDate,
          planEndDate: editPlanEndDate,
          accountStatus: editAccountStatus,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "No se pudieron actualizar los datos de la usuaria");
      }

      setEditSuccess(true);
      await loadUsers();
      setTimeout(() => {
        setEditSuccess(false);
        setEditModalUser(null);
      }, 1000);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditingUserLoading(false);
    }
  };

  // Abrir modal de edición prellenando todos los campos
  const openEditModal = (u: UserProfile) => {
    setEditModalUser(u);
    setEditFullName(u.full_name || "");
    setEditBusinessName(u.business_name || "");
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");

    const planType = u.plan_type || "prueba";
    const startDate =
      u.plan_start_date ||
      u.created_at?.split("T")[0] ||
      new Date().toISOString().split("T")[0];
    const endDate =
      u.plan_end_date || calculatePlanEndDate(startDate, planType);
    const accStatus =
      u.account_status || (u.status === "suspended" ? "suspended" : "active");

    setEditPlanType(planType);
    setEditPlanStartDate(startDate);
    setEditPlanEndDate(endDate);
    setEditAccountStatus(accStatus);
    setEditError(null);
    setEditSuccess(false);
  };

  // Calcular contadores de filtros rápidos
  const userStats = users.reduce(
    (acc, u) => {
      const info = getPlanStatusInfo(u.plan_end_date);
      const accStatus =
        u.account_status || (u.status === "suspended" ? "suspended" : "active");
      const isVencido = info.status === "vencido" || info.remainingDays < 0;
      const isProximo = !isVencido && info.remainingDays <= 3 && info.remainingDays >= 0;

      acc.todos++;
      if (accStatus === "active" && !isVencido) acc.activos++;
      if (isProximo) acc.proximos++;
      if (isVencido) acc.vencidos++;
      if (accStatus === "deactivated" || accStatus === "suspended") acc.desactivados++;

      return acc;
    },
    { todos: 0, activos: 0, proximos: 0, vencidos: 0, desactivados: 0 }
  );

  const isAnyFilterActive = Boolean(
    search.trim() ||
    filterPlan !== "todos" ||
    filterVigencia !== "todas" ||
    filterStatus !== "todos" ||
    quickFilter !== "todos"
  );

  const activeFiltersCount = [
    Boolean(search.trim()),
    filterPlan !== "todos",
    filterVigencia !== "todas",
    filterStatus !== "todos",
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setSearch("");
    setFilterPlan("todos");
    setFilterVigencia("todas");
    setFilterStatus("todos");
    setQuickFilter("todos");
  };

  // Filtrar usuarias por texto y filtros combinados (intersección AND)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Buscador por texto (nombre, email, n° de cuenta, emprendimiento o teléfono)
      const matches = matchesSearch(
        [u.email, u.full_name, u.business_name, u.account_number, u.phone],
        search
      );
      if (!matches) return false;

      // 2. Filtro de Tipo de Plan
      const userPlan = u.plan_type || "prueba";
      if (filterPlan !== "todos" && userPlan !== filterPlan) {
        return false;
      }

      // 3. Filtro de Vigencia (usando getPlanStatusInfo)
      const info = getPlanStatusInfo(u.plan_end_date);
      const isVencido = info.status === "vencido" || info.remainingDays < 0;
      const isProximo = !isVencido && info.remainingDays <= 3 && info.remainingDays >= 0;
      const isVigente = !isVencido && !isProximo;

      if (filterVigencia === "vigente" && !isVigente) return false;
      if (filterVigencia === "proximo" && !isProximo) return false;
      if (filterVigencia === "vencido" && !isVencido) return false;

      // 4. Filtro de Estado de Cuenta
      const effectiveAccountStatus =
        u.account_status || (u.status === "suspended" ? "suspended" : "active");
      if (filterStatus === "active" && effectiveAccountStatus !== "active") {
        return false;
      }
      if (
        filterStatus === "suspended" &&
        effectiveAccountStatus !== "suspended" &&
        effectiveAccountStatus !== "deactivated"
      ) {
        return false;
      }

      // 5. Presets de Filtros Rápidos (si están seleccionados desde los chips)
      if (quickFilter === "activos") {
        if (effectiveAccountStatus !== "active" || isVencido) return false;
      } else if (quickFilter === "proximos") {
        if (!isProximo) return false;
      } else if (quickFilter === "vencidos") {
        if (!isVencido) return false;
      } else if (quickFilter === "desactivados") {
        if (effectiveAccountStatus !== "deactivated" && effectiveAccountStatus !== "suspended") {
          return false;
        }
      }

      return true;
    });
  }, [users, search, filterPlan, filterVigencia, filterStatus, quickFilter]);

  if (loading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center space-y-3 font-body">
        <div className="w-10 h-10 border-3 border-[#3BB578] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#7A7A7A]">Cargando usuarias y planes...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center space-y-3 font-body p-6 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#2B2B2B] font-display">Acceso Restringido</h2>
        <p className="text-xs text-[#7A7A7A] max-w-sm">
          Esta sección está reservada exclusivamente para la administración general del sistema (SuperAdmin Gio).
        </p>
        <Link
          href="/dashboard"
          className="mt-2 py-2 px-4 bg-[#3BB578] text-white rounded-2xl text-xs font-bold shadow-xs hover:bg-[#2E9E65] transition"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4 font-body pb-10">
      {/* Header Admin */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/configuracion"
            className="p-2 bg-white hover:bg-neutral-50 text-[#2B2B2B] rounded-2xl border border-[#EAF0E8] transition shadow-xs"
            title="Volver a Configuración"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-[#2B2B2B] flex items-center gap-2 font-display">
              <span>Panel Gio</span>
              <span className="text-xs bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full font-body">
                SuperAdmin
              </span>
            </h2>
            <p className="text-xs text-[#7A7A7A]">Gestión de planes, estado y altas de usuarias</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Exportar CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredUsers.length === 0}
            title={
              filteredUsers.length === 0
                ? "No hay usuarias para exportar"
                : isAnyFilterActive
                ? `Exportar ${filteredUsers.length} usuarias filtradas a CSV`
                : `Exportar todas las usuarias (${filteredUsers.length}) a CSV`
            }
            className="py-2.5 px-3.5 bg-white hover:bg-neutral-50 text-[#2B2B2B] border border-[#EAF0E8] rounded-2xl shadow-xs transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#3BB578]" />
            <span>Exportar CSV</span>
            {filteredUsers.length > 0 && (
              <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {filteredUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setNewEmail("");
              setNewPassword("");
              setNewFullName("");
              setNewBusinessName("");
              setNewPlanType("prueba");
              setNewPlanStartDate(today);
              setNewPlanEndDate(calculatePlanEndDate(today, "prueba"));
              setNewAccountStatus("active");
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="py-2.5 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl shadow-xs transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Alta Usuaria</span>
          </button>
        </div>
      </div>

      {/* Buscador de Usuarias */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por n° de cuenta, email, nombre o emprendimiento..."
          className="w-full pl-10 pr-10 py-2.5 text-xs bg-white border border-[#EAF0E8] rounded-2xl focus:border-[#3BB578] outline-none shadow-xs text-[#2B2B2B]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 transition"
            title="Borrar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtros Rápidos (Chips) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => {
            resetAllFilters();
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            quickFilter === "todos" && !isAnyFilterActive
              ? "bg-[#2B2B2B] text-white shadow-xs"
              : "bg-white text-[#7A7A7A] hover:bg-neutral-50 border border-[#EAF0E8]"
          }`}
        >
          <span>Todos</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              quickFilter === "todos" && !isAnyFilterActive
                ? "bg-white/25 text-white"
                : "bg-neutral-100 text-[#2B2B2B]"
            }`}
          >
            {userStats.todos}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickFilter("activos");
            setFilterStatus("active");
            setFilterVigencia("todas");
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            quickFilter === "activos"
              ? "bg-[#1F7A4C] text-white shadow-xs"
              : "bg-white text-[#7A7A7A] hover:bg-neutral-50 border border-[#EAF0E8]"
          }`}
        >
          <span>Activos</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              quickFilter === "activos"
                ? "bg-white/25 text-white"
                : "bg-[#DCF4D7] text-[#1F7A4C]"
            }`}
          >
            {userStats.activos}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickFilter("proximos");
            setFilterVigencia("proximo");
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            quickFilter === "proximos"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-white text-[#7A7A7A] hover:bg-neutral-50 border border-[#EAF0E8]"
          }`}
        >
          <span>Próximos a vencer</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              quickFilter === "proximos"
                ? "bg-white/25 text-white"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {userStats.proximos}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickFilter("vencidos");
            setFilterVigencia("vencido");
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            quickFilter === "vencidos"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-white text-[#7A7A7A] hover:bg-neutral-50 border border-[#EAF0E8]"
          }`}
        >
          <span>Vencidos</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              quickFilter === "vencidos"
                ? "bg-white/25 text-white"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {userStats.vencidos}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickFilter("desactivados");
            setFilterStatus("suspended");
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            quickFilter === "desactivados"
              ? "bg-neutral-700 text-white shadow-xs"
              : "bg-white text-[#7A7A7A] hover:bg-neutral-50 border border-[#EAF0E8]"
          }`}
        >
          <span>Desactivados</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              quickFilter === "desactivados"
                ? "bg-white/25 text-white"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {userStats.desactivados}
          </span>
        </button>
      </div>

      {/* Barra de Filtros Avanzados (Multicriterio) */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-[#EAF0E8] shadow-xs space-y-3">
        {/* Cabecera de la barra de filtros */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#2B2B2B] flex items-center gap-1.5 font-display text-sm">
              <SlidersHorizontal className="w-4 h-4 text-[#3BB578]" />
              <span>Filtros avanzados</span>
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] font-bold px-2 py-0.5 rounded-full border border-[#C3EBC0]">
                {activeFiltersCount} {activeFiltersCount === 1 ? "activo" : "activos"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Contador de resultados */}
            <span className="text-xs text-[#7A7A7A]">
              Mostrando <strong className="text-[#2B2B2B] font-bold">{filteredUsers.length}</strong> de{" "}
              <span>{users.length}</span> usuarias
            </span>

            {/* Acceso rápido para exportar CSV desde la barra de filtros */}
            {filteredUsers.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#1F7A4C] hover:text-[#185E3A] bg-[#DCF4D7]/70 hover:bg-[#DCF4D7] border border-[#C3EBC0] px-2.5 py-1 rounded-xl transition cursor-pointer"
                title={`Exportar ${filteredUsers.length} usuarias a CSV`}
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            )}

            {/* Botón Restablecer filtros */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 hover:text-rose-600 bg-neutral-100 hover:bg-rose-50 px-2.5 py-1 rounded-xl transition cursor-pointer"
                title="Restablecer todos los filtros"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}

            {/* Botón Colapsar en Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
              className="sm:hidden p-1.5 text-neutral-500 hover:text-[#2B2B2B] bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
              title={isMobileFiltersOpen ? "Ocultar selectores" : "Mostrar selectores"}
            >
              {isMobileFiltersOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Grid de Selectores (visible en desktop siempre, colapsable en mobile) */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 ${isMobileFiltersOpen ? "grid" : "hidden sm:grid"}`}>
          {/* 1. Selector de Plan */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#3BB578]" />
              <span>Tipo de Plan</span>
            </label>
            <div className="relative">
              <select
                value={filterPlan}
                onChange={(e) => {
                  setFilterPlan(e.target.value as FilterPlan);
                  if (quickFilter !== "todos") setQuickFilter("todos");
                }}
                className={`w-full text-xs rounded-xl px-3 py-2 pr-8 border outline-none font-medium cursor-pointer transition appearance-none ${
                  filterPlan !== "todos"
                    ? "bg-[#DCF4D7]/40 border-[#3BB578] text-[#1F7A4C] font-bold"
                    : "bg-neutral-50/80 border-[#EAF0E8] text-[#2B2B2B] hover:bg-white focus:bg-white focus:border-[#3BB578]"
                }`}
              >
                <option value="todos">Todos los planes</option>
                <option value="prueba">Plan Prueba</option>
                <option value="mensual">Plan Mensual</option>
                <option value="anual">Plan Anual</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* 2. Selector de Vigencia */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#3BB578]" />
              <span>Vigencia del Plan</span>
            </label>
            <div className="relative">
              <select
                value={filterVigencia}
                onChange={(e) => {
                  setFilterVigencia(e.target.value as FilterVigencia);
                  if (quickFilter !== "todos") setQuickFilter("todos");
                }}
                className={`w-full text-xs rounded-xl px-3 py-2 pr-8 border outline-none font-medium cursor-pointer transition appearance-none ${
                  filterVigencia !== "todas"
                    ? "bg-[#DCF4D7]/40 border-[#3BB578] text-[#1F7A4C] font-bold"
                    : "bg-neutral-50/80 border-[#EAF0E8] text-[#2B2B2B] hover:bg-white focus:bg-white focus:border-[#3BB578]"
                }`}
              >
                <option value="todas">Todas las vigencias</option>
                <option value="vigente">Vigente</option>
                <option value="proximo">Próximo a vencer (≤ 3 días)</option>
                <option value="vencido">Vencido</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* 3. Selector de Estado de Cuenta */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
              <Power className="w-3 h-3 text-[#3BB578]" />
              <span>Estado de la Cuenta</span>
            </label>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as FilterStatus);
                  if (quickFilter !== "todos") setQuickFilter("todos");
                }}
                className={`w-full text-xs rounded-xl px-3 py-2 pr-8 border outline-none font-medium cursor-pointer transition appearance-none ${
                  filterStatus !== "todos"
                    ? "bg-[#DCF4D7]/40 border-[#3BB578] text-[#1F7A4C] font-bold"
                    : "bg-neutral-50/80 border-[#EAF0E8] text-[#2B2B2B] hover:bg-white focus:bg-white focus:border-[#3BB578]"
                }`}
              >
                <option value="todos">Todos los estados</option>
                <option value="active">Activa</option>
                <option value="suspended">Suspendida / Apagada</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Usuarias */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-[#EAF0E8] text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
            <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center">
              <FilterX className="w-6 h-6 text-neutral-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2B2B2B]">
                No se encontraron usuarias con los filtros seleccionados
              </p>
              <p className="text-xs text-[#7A7A7A] mt-1 max-w-sm mx-auto">
                No hay coincidencias que cumplan con la combinación de filtros aplicada o el término buscado.
              </p>
            </div>
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 py-2 px-4 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] text-xs font-bold rounded-2xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
        ) : (
          filteredUsers.map((u) => {
            const planStatusInfo = getPlanStatusInfo(u.plan_end_date);
            const accountStatus =
              u.account_status || (u.status === "suspended" ? "suspended" : "active");
            const isAccountActive = accountStatus === "active";
            const planType = u.plan_type || "prueba";

            return (
              <div
                key={u.id}
                className={`bg-white rounded-3xl p-4 border shadow-xs transition flex flex-col space-y-3 ${
                  isAccountActive ? "border-[#EAF0E8]" : "border-rose-200 bg-rose-50/15"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {/* Avatar / Logo */}
                    {u.avatar_url && isRealUserAvatar(u.avatar_url) ? (
                      <img
                        src={u.avatar_url.trim()}
                        alt={u.full_name || u.email}
                        className="w-10 h-10 rounded-2xl object-cover border border-[#EAF0E8] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#2B2B2B]">
                          {u.full_name || "Sin nombre"}
                        </span>

                        {/* Badge N° de Cuenta HABA */}
                        {u.account_number && (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-[#3BB578]" />
                            {u.account_number}
                          </span>
                        )}

                        {/* Badge NUEVA (Altas recientes o registro autogestionado) */}
                        {u.is_new && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Nueva</span>
                          </span>
                        )}

                        {/* Badge PLAN */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Plan {PLAN_NAMES[planType] || planType}
                        </span>

                        {/* Badge ESTADO DEL PLAN */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${planStatusInfo.badgeBg} ${planStatusInfo.badgeText} ${planStatusInfo.badgeBorder}`}
                        >
                          {planStatusInfo.label}
                        </span>

                        {/* Badge ESTADO DE CUENTA */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            accountStatus === "active"
                              ? "bg-[#DCF4D7] text-[#1F7A4C]"
                              : accountStatus === "suspended"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {ACCOUNT_STATUS_NAMES[accountStatus] || accountStatus}
                        </span>

                        {u.role === "admin" && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}

                        {/* Badge Mercado Pago (Opción B) */}
                        {u.mp_status && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              u.mp_status === "authorized"
                                ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200"
                            }`}
                            title={u.mp_preapproval_id ? `ID MP: ${u.mp_preapproval_id}` : undefined}
                          >
                            MP: {u.mp_status === "authorized" ? "Activa" : u.mp_status}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#7A7A7A] mt-0.5">{u.email}</p>

                      {u.business_name && (
                        <p className="text-[11px] text-[#7A7A7A] mt-0.5">
                          Emprendimiento: <strong>{u.business_name}</strong>
                        </p>
                      )}

                      {/* WhatsApp / Teléfono de Contacto */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {u.phone ? (
                          <>
                            <span className="text-[11px] text-[#2B2B2B] font-semibold flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200">
                              <Phone className="w-3 h-3 text-[#3BB578]" />
                              <span>{u.phone}</span>
                            </span>
                            <a
                              href={buildWhatsAppUrl(u.phone, u.full_name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] text-[11px] font-bold border border-[#C3EBC0] transition shadow-2xs active:scale-95"
                              title={`Abrir chat de WhatsApp con ${u.full_name || u.email}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-[#25D366] fill-[#25D366]" />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic flex items-center gap-1">
                            <Phone className="w-3 h-3 text-neutral-300" />
                            <span>Sin WhatsApp registrado</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Gio */}
                  <div className="flex items-center gap-1">
                    {/* Botón Sincronizar Mercado Pago */}
                    {u.role !== "admin" && (
                      <button
                        onClick={() => syncUserMercadoPago(u)}
                        disabled={syncingUserId === u.id}
                        className="p-2 text-neutral-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition disabled:opacity-50"
                        title="Sincronizar estado con Mercado Pago"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            syncingUserId === u.id ? "animate-spin text-cyan-600" : ""
                          }`}
                        />
                      </button>
                    )}

                    {/* Botón Editar Datos y Plan */}
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-2 text-neutral-400 hover:text-[#3BB578] hover:bg-[#DCF4D7]/50 rounded-xl transition"
                      title="Editar datos y plan de esta usuaria"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Botón Reset Password */}
                    <button
                      onClick={() => {
                        setResetModalUser(u);
                        setResetPassword("");
                        setResetError(null);
                        setResetSuccess(false);
                      }}
                      className="p-2 text-neutral-400 hover:text-[#3BB578] hover:bg-[#DCF4D7]/50 rounded-xl transition"
                      title="Cambiar contraseña de esta cuenta"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>

                    {/* Botón Apagar / Activar */}
                    <button
                      onClick={() => toggleUserActive(u)}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                        isAccountActive
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700"
                          : "bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C]"
                      }`}
                      title={isAccountActive ? "Apagar / Suspender cuenta" : "Activar cuenta"}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isAccountActive ? "Apagar" : "Activar"}</span>
                    </button>

                    {/* Botón Eliminar */}
                    {u.role !== "admin" && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 text-neutral-300 hover:text-rose-600 rounded-xl transition"
                        title="Eliminar usuaria definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Vigencia, Fechas del Plan y Botón de Histórico */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#7A7A7A]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      Alta HABA: <strong className="text-[#2B2B2B]">{formatDateDisplay(u.created_at)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Plan: <strong>{formatDateDisplay(u.plan_start_date)}</strong> al <strong>{formatDateDisplay(u.plan_end_date)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span className={planStatusInfo.badgeText}>{planStatusInfo.rowText}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedHistoryUserId(expandedHistoryUserId === u.id ? null : u.id)
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                        expandedHistoryUserId === u.id
                          ? "bg-[#2B2B2B] text-white"
                          : "bg-neutral-100 hover:bg-neutral-200 text-[#1F7A4C]"
                      }`}
                      title="Ver trazabilidad completa de fechas y períodos de esta cuenta"
                    >
                      <History className="w-3 h-3" />
                      <span>{expandedHistoryUserId === u.id ? "Cerrar" : "Histórico"}</span>
                      {expandedHistoryUserId === u.id ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Sección Expandible de Histórico de Cuenta */}
                {expandedHistoryUserId === u.id && (() => {
                  const trialStart = (u.created_at || "").split("T")[0] || u.plan_start_date;
                  const trialEnd = calculatePlanEndDate(trialStart, "prueba");
                  const isTrialCurrent = u.plan_type === "prueba";

                  return (
                    <div className="pt-2 border-t border-neutral-200/80 bg-neutral-50/70 -mx-4 -mb-4 p-4 rounded-b-3xl space-y-2.5 text-xs text-[#2B2B2B] animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-[#1F7A4C] flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-[#3BB578]" />
                          Histórico y Trazabilidad de la Cuenta
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ID: {u.id.substring(0, 8)}...
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 1. Alta Original */}
                        <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-2xs">
                          <p className="text-[10px] uppercase font-bold text-neutral-400">1. Alta Inicial en HABA</p>
                          <p className="text-xs font-bold text-[#2B2B2B] mt-0.5">{formatDateDisplay(u.created_at)}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            Origen: {u.registration_source === "admin" ? "Alta por Gio (Admin)" : "Registro público"}
                          </p>
                        </div>

                        {/* 2. Período de Prueba */}
                        <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase font-bold text-neutral-400">2. Período de Prueba</p>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                isTrialCurrent ? "bg-amber-100 text-amber-800" : "bg-[#DCF4D7] text-[#1F7A4C]"
                              }`}
                            >
                              {isTrialCurrent ? "En curso" : "Completada"}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[#2B2B2B] mt-0.5">
                            {formatDateDisplay(trialStart)} al {formatDateDisplay(trialEnd)}
                          </p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            15 días de prueba inicial
                          </p>
                        </div>

                        {/* 3. Plan Actual & Mercado Pago */}
                        <div className="bg-white p-2.5 rounded-2xl border border-neutral-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase font-bold text-neutral-400">3. Plan Actual</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700">
                              Plan {PLAN_NAMES[planType] || planType}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[#2B2B2B] mt-0.5">
                            {formatDateDisplay(u.plan_start_date)} al {formatDateDisplay(u.plan_end_date)}
                          </p>
                          <p className="text-[10px] text-neutral-500 mt-0.5 truncate" title={u.mp_preapproval_id || undefined}>
                            {u.mp_preapproval_id
                              ? `MP ID: ${u.mp_preapproval_id.substring(0, 14)}...`
                              : "Sin suscripción MP registrada"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* Modal para Crear Usuaria montado en Portal */}
      {isCreateModalOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed -top-40 -bottom-40 -left-20 -right-20 z-[99999] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center pt-40 pb-40 px-20 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCreateModalOpen(false);
            }}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] animate-in slide-in-from-bottom-6 flex flex-col overflow-hidden"
              style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 20px) - 10px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#DCF4D7] text-[#3BB578] flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#2B2B2B] font-display">
                    Alta de Nueva Usuaria
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createError && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="mt-3 space-y-3 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Email de acceso *</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="clienta@correo.com"
                    required
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Contraseña inicial *</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres (ej: haba123)"
                    required
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Nombre de la usuaria</label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Ej: Giulianna Penna"
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Nombre del emprendimiento</label>
                  <input
                    type="text"
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    placeholder="Ej: Amaoto Craft"
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#3BB578]" />
                    <span>WhatsApp / Teléfono de contacto (Opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Ej: 11 2345 6789 o 341 555 1234"
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                  <p className="text-[10px] text-neutral-400">
                    Permite contactar a la clienta por WhatsApp con un solo clic.
                  </p>
                </div>

                {/* Configuración del Plan */}
                <div className="p-3 bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl space-y-2.5">
                  <p className="text-[11px] font-bold text-[#1F7A4C] uppercase tracking-wider">
                    Configuración de Plan y Estado
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">Plan *</label>
                      <input
                        type="text"
                        readOnly
                        value="Prueba (15 días)"
                        className="w-full px-2.5 py-1.5 text-xs bg-neutral-100 border border-[#EAF0E8] rounded-xl text-neutral-600 font-semibold cursor-not-allowed select-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">
                        Estado de Cuenta *
                      </label>
                      <select
                        value={newAccountStatus}
                        onChange={(e) => setNewAccountStatus(e.target.value as AccountStatus)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      >
                        <option value="active">Activa</option>
                        <option value="suspended">Suspendida</option>
                        <option value="deactivated">Desactivada</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">
                        Fecha de Inicio *
                      </label>
                      <input
                        type="date"
                        value={newPlanStartDate}
                        onChange={(e) => {
                          const d = e.target.value;
                          setNewPlanStartDate(d);
                          setNewPlanEndDate(calculatePlanEndDate(d, newPlanType));
                        }}
                        required
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">
                        Fecha de Fin *
                      </label>
                      <input
                        type="date"
                        value={newPlanEndDate}
                        onChange={(e) => setNewPlanEndDate(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="pt-2 flex gap-2 flex-shrink-0"
                  style={{ paddingBottom: "max(env(safe-area-inset-bottom, 12px), 16px)" }}
                >
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-[#7A7A7A] rounded-2xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="flex-1 py-2.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold shadow-xs disabled:opacity-60 transition"
                  >
                    {creatingUser ? "Creando..." : "Crear Cuenta"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal para Resetear Contraseña montado en Portal */}
      {resetModalUser &&
        mounted &&
        createPortal(
          <div
            className="fixed -top-40 -bottom-40 -left-20 -right-20 z-[99999] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center pt-40 pb-40 px-20 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setResetModalUser(null);
            }}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] animate-in slide-in-from-bottom-6 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#2B2B2B] font-display">
                    Resetear Contraseña
                  </h3>
                </div>
                <button
                  onClick={() => setResetModalUser(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#7A7A7A] mt-2">
                Asigná una nueva clave para <strong>{resetModalUser.full_name || resetModalUser.email}</strong>.
              </p>

              {resetError && (
                <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="mt-2 p-2.5 bg-[#DCF4D7] border border-[#C3EBC0] rounded-xl text-[#1F7A4C] text-xs flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>¡Contraseña actualizada con éxito!</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Nueva Contraseña *</label>
                  <input
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div
                  className="pt-2 flex gap-2"
                  style={{ paddingBottom: "max(env(safe-area-inset-bottom, 12px), 16px)" }}
                >
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="flex-1 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-[#7A7A7A] rounded-2xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resettingPassword || resetSuccess}
                    className="flex-1 py-2.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold shadow-xs disabled:opacity-60 transition"
                  >
                    {resettingPassword ? "Guardando..." : "Guardar Contraseña"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal para Editar Datos y Plan de Usuaria montado en Portal */}
      {editModalUser &&
        mounted &&
        createPortal(
          <div
            className="fixed -top-40 -bottom-40 -left-20 -right-20 z-[99999] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center pt-40 pb-40 px-20 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditModalUser(null);
            }}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] animate-in slide-in-from-bottom-6 flex flex-col overflow-hidden"
              style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 20px) - 10px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#DCF4D7] text-[#3BB578] flex items-center justify-center">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#2B2B2B] font-display">
                    Editar Datos y Plan de Usuaria
                  </h3>
                </div>
                <button
                  onClick={() => setEditModalUser(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="mt-3 p-2.5 bg-[#DCF4D7] border border-[#C3EBC0] rounded-xl text-[#1F7A4C] text-xs flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>¡Datos y plan actualizados con éxito!</span>
                </div>
              )}

              <form onSubmit={handleEditUserSubmit} className="mt-3 space-y-3 flex-1 overflow-y-auto">
                {/* ID de Cuenta HABA (Inmutable / Read-only) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B] flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#3BB578]" />
                    N° de Cuenta / ID HABA
                  </label>
                  <input
                    type="text"
                    value={editModalUser.account_number || "Sin ID asignado"}
                    disabled
                    readOnly
                    className="w-full px-3.5 py-2 text-xs bg-neutral-100 border border-neutral-200 rounded-2xl text-neutral-600 font-mono font-bold cursor-not-allowed select-all"
                  />
                  <p className="text-[10px] text-neutral-400">Identificador inalterable autogenerado por el sistema.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Nombre de la usuaria</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Ej: Giulianna Penna"
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Nombre del emprendimiento</label>
                  <input
                    type="text"
                    value={editBusinessName}
                    onChange={(e) => setEditBusinessName(e.target.value)}
                    placeholder="Ej: Amaoto Craft"
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#3BB578]" />
                      <span>WhatsApp / Teléfono</span>
                    </span>
                    {editPhone && (
                      <a
                        href={buildWhatsAppUrl(editPhone, editFullName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#1F7A4C] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3 text-[#25D366] fill-[#25D366]" />
                        <span>Abrir WhatsApp</span>
                      </a>
                    )}
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Ej: 11 2345 6789 o 341 555 1234"
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2B2B2B]">Email de acceso *</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="clienta@correo.com"
                    required
                    className="w-full px-3.5 py-2 text-xs bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                  />
                </div>

                {/* Resumen Histórico de la Cuenta */}
                {editModalUser && (() => {
                  const trialStart = (editModalUser.created_at || "").split("T")[0] || editModalUser.plan_start_date;
                  const trialEnd = calculatePlanEndDate(trialStart, "prueba");
                  return (
                    <div className="p-3 bg-neutral-100/70 border border-neutral-200 rounded-2xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-[#1F7A4C] flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-[#3BB578]" />
                          Histórico y Alta en HABA
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Alta: {formatDateDisplay(editModalUser.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 pt-1">
                        <div>
                          <span className="text-neutral-400 block text-[10px] font-bold uppercase">Prueba inicial (15 días)</span>
                          <span className="font-semibold text-neutral-800">{formatDateDisplay(trialStart)} al {formatDateDisplay(trialEnd)}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] font-bold uppercase">Plan actual</span>
                          <span className="font-semibold text-neutral-800">Plan {PLAN_NAMES[editModalUser.plan_type || "prueba"]}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Configuración del Plan */}
                <div className="p-3 bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl space-y-2.5">
                  <p className="text-[11px] font-bold text-[#1F7A4C] uppercase tracking-wider">
                    Configuración de Plan y Estado
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">Plan *</label>
                      <select
                        value={editPlanType}
                        onChange={(e) => {
                          const p = e.target.value as PlanType;
                          setEditPlanType(p);
                          setEditPlanEndDate(calculatePlanEndDate(editPlanStartDate, p));
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      >
                        <option value="prueba">Prueba (15 días)</option>
                        <option value="mensual">Mensual (1 mes)</option>
                        <option value="trimestral">Trimestral (3 meses)</option>
                        <option value="anual">Anual (1 año)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">
                        Estado de Cuenta *
                      </label>
                      <select
                        value={editAccountStatus}
                        onChange={(e) => setEditAccountStatus(e.target.value as AccountStatus)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      >
                        <option value="active">Activa</option>
                        <option value="suspended">Suspendida</option>
                        <option value="deactivated">Desactivada</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">
                        Fecha de Inicio *
                      </label>
                      <input
                        type="date"
                        value={editPlanStartDate}
                        onChange={(e) => {
                          const d = e.target.value;
                          setEditPlanStartDate(d);
                          setEditPlanEndDate(calculatePlanEndDate(d, editPlanType));
                        }}
                        required
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">
                        Fecha de Fin *
                      </label>
                      <input
                        type="date"
                        value={editPlanEndDate}
                        onChange={(e) => setEditPlanEndDate(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#EAF0E8] rounded-xl focus:border-[#3BB578] outline-none text-[#2B2B2B]"
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="pt-2 flex gap-2 flex-shrink-0"
                  style={{ paddingBottom: "max(env(safe-area-inset-bottom, 12px), 16px)" }}
                >
                  <button
                    type="button"
                    onClick={() => setEditModalUser(null)}
                    className="flex-1 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-[#7A7A7A] rounded-2xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editingUserLoading || editSuccess}
                    className="flex-1 py-2.5 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold shadow-xs disabled:opacity-60 transition"
                  >
                    {editingUserLoading ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Toast de confirmación de exportación */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F7A4C] text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-[#2E9E65]">
          <Check className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
