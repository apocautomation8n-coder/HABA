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
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
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
}

type QuickFilter = "todos" | "activos" | "proximos" | "vencidos" | "desactivados";

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");

  // Modal para dar de alta nueva usuaria
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
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

      // Validar rol de admin
      let hasAdmin = checkIsAdmin(user);

      if (!hasAdmin) {
        try {
          const resProfile = await fetch("/api/user/profile");
          if (resProfile.ok) {
            const profileData = await resProfile.json();
            if (profileData.isAdmin) hasAdmin = true;
          }
        } catch {
          // ignore
        }
      }

      if (!hasAdmin) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Cargar perfiles y planes mediante API segura
      const res = await fetch("/api/admin/users");
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

      acc.todos++;
      if (accStatus === "active" && info.status !== "vencido") acc.activos++;
      if (info.status === "proximo_a_vencer") acc.proximos++;
      if (info.status === "vencido") acc.vencidos++;
      if (accStatus === "deactivated" || accStatus === "suspended") acc.desactivados++;

      return acc;
    },
    { todos: 0, activos: 0, proximos: 0, vencidos: 0, desactivados: 0 }
  );

  // Filtrar usuarias por texto y filtro rápido
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matches = matchesSearch(
        [u.email, u.full_name, u.business_name, u.account_number],
        search
      );

      if (!matches) return false;

      const info = getPlanStatusInfo(u.plan_end_date);
      const accStatus =
        u.account_status || (u.status === "suspended" ? "suspended" : "active");

      if (quickFilter === "activos") {
        return accStatus === "active" && info.status !== "vencido";
      }
      if (quickFilter === "proximos") {
        return info.status === "proximo_a_vencer";
      }
      if (quickFilter === "vencidos") {
        return info.status === "vencido";
      }
      if (quickFilter === "desactivados") {
        return accStatus === "deactivated" || accStatus === "suspended";
      }

      return true;
    });
  }, [users, search, quickFilter]);

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

      {/* Filtros Rápidos */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => {
            setQuickFilter("todos");
            setSearch("");
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            quickFilter === "todos"
              ? "bg-[#2B2B2B] text-white shadow-xs"
              : "bg-white text-[#7A7A7A] hover:bg-neutral-50 border border-[#EAF0E8]"
          }`}
        >
          <span>Todos</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              quickFilter === "todos" ? "bg-white/25 text-white" : "bg-neutral-100 text-[#2B2B2B]"
            }`}
          >
            {userStats.todos}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickFilter("activos");
            setSearch("");
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
            setSearch("");
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
            setSearch("");
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
            setSearch("");
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

      {/* Lista de Usuarias */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-[#EAF0E8] text-center text-xs text-[#7A7A7A]">
            No se encontraron usuarias con los filtros seleccionados.
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
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
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
                      </div>

                      <p className="text-xs text-[#7A7A7A] mt-0.5">{u.email}</p>

                      {u.business_name && (
                        <p className="text-[11px] text-[#7A7A7A] mt-0.5">
                          Emprendimiento: <strong>{u.business_name}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones de Gio */}
                  <div className="flex items-center gap-1">
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

                {/* Vigencia y Fechas del Plan */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#7A7A7A]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      Inicio: <strong>{formatDateDisplay(u.plan_start_date)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Finaliza: <strong>{formatDateDisplay(u.plan_end_date)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span className={planStatusInfo.badgeText}>{planStatusInfo.rowText}</span>
                  </div>
                </div>
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

                {/* Configuración del Plan */}
                <div className="p-3 bg-[#F6F7F2] border border-[#EAF0E8] rounded-2xl space-y-2.5">
                  <p className="text-[11px] font-bold text-[#1F7A4C] uppercase tracking-wider">
                    Configuración de Plan y Estado
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#2B2B2B]">Plan *</label>
                      <select
                        value={newPlanType}
                        onChange={(e) => {
                          const p = e.target.value as PlanType;
                          setNewPlanType(p);
                          setNewPlanEndDate(calculatePlanEndDate(newPlanStartDate, p));
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
    </div>
  );
}
