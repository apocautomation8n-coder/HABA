"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  UserPlus,
  Power,
  Trash2,
  ArrowLeft,
  Search,
  Check,
  AlertCircle,
  Sparkles,
  Mail,
  Store,
  KeyRound,
  Edit2,
  X,
  Loader2,
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  business_name?: string;
  role: "admin" | "user";
  status: "active" | "suspended";
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");

  // Modal para dar de alta nueva usuaria
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal para cambiar contraseña
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Modal para editar datos de usuaria
  const [editModalUser, setEditModalUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editEmail, setEditEmail] = useState("");
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

  // Verificar rol de admin y cargar usuarias
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

      // Validar rol de admin de forma resiliente
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

      // Cargar perfiles mediante API segura (evita RLS recursivo)
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
    const isCurrentlyActive = targetUser.status === "active";
    const nextStatus = isCurrentlyActive ? "suspended" : "active";
    const actionName = isCurrentlyActive ? "apagar (suspender)" : "activar";

    const confirm = window.confirm(
      `¿Estás segura de ${actionName} la cuenta de "${targetUser.full_name || targetUser.email}"?`
    );
    if (!confirm) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id, status: nextStatus }),
      });

      const resJson = await res.json();
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u))
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
      `¿ELIMINAR DEFINITIVAMENTE a "${targetUser.full_name || targetUser.email}"?\n\nEsta acción borrará permanentemente su cuenta y todos sus productos, insumos y presupuestos.`
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

  // Crear nueva usuaria
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
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Error al crear usuaria");
      }

      // Éxito: recargar lista y limpiar form
      await loadUsers();
      setIsCreateModalOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewBusinessName("");
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

  // Guardar cambios de datos de usuaria
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

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (u.business_name && u.business_name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HabaMascot size={70} className="animate-bounce" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-3 font-body">
        <HabaMascot size={70} />
        <h3 className="text-base font-bold text-rose-700 font-display">Acceso Restringido</h3>
        <p className="text-xs text-[#7A7A7A]">
          Solo la administradora Giulianna (Gio) tiene acceso a este panel de control.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-2 py-2 px-4 bg-neutral-100 text-[#2B2B2B] rounded-2xl text-xs font-semibold"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4 pb-12 font-body">
      {/* Header Admin */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/configuracion"
            className="p-2 bg-white hover:bg-neutral-100 text-[#2B2B2B] rounded-2xl border border-[#EAF0E8] shadow-xs transition"
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
            <p className="text-xs text-[#7A7A7A]">Gestión de altas, apagado y bajas de usuarias</p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
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
          placeholder="Buscar por email, nombre o emprendimiento..."
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-[#EAF0E8] rounded-2xl focus:border-[#3BB578] outline-none shadow-xs text-[#2B2B2B]"
        />
      </div>

      {/* Lista de Usuarias */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-[#EAF0E8] text-center text-xs text-[#7A7A7A]">
            No se encontraron usuarias registradas.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isActive = u.status === "active";

            return (
              <div
                key={u.id}
                className={`bg-white rounded-3xl p-4 border shadow-xs transition flex flex-col space-y-3 ${
                  isActive ? "border-[#EAF0E8]" : "border-rose-200 bg-rose-50/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#2B2B2B]">
                        {u.full_name || "Sin nombre"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-[#DCF4D7] text-[#1F7A4C]"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {isActive ? "Activa" : "Apagada / Suspendida"}
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

                  {/* Acciones de Gio */}
                  <div className="flex items-center gap-1.5">
                    {/* Botón Editar Datos */}
                    <button
                      onClick={() => {
                        setEditModalUser(u);
                        setEditFullName(u.full_name || "");
                        setEditBusinessName(u.business_name || "");
                        setEditEmail(u.email || "");
                        setEditError(null);
                        setEditSuccess(false);
                      }}
                      className="p-2 text-neutral-400 hover:text-[#3BB578] hover:bg-[#DCF4D7]/50 rounded-xl transition"
                      title="Editar datos de esta usuaria"
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
                        isActive
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700"
                          : "bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C]"
                      }`}
                      title={isActive ? "Apagar cuenta" : "Encender cuenta"}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isActive ? "Apagar" : "Activar"}</span>
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
              </div>
            );
          })
        )}
      </div>

      {/* Modal para Crear Usuaria montado en Portal con cobertura completa de notch / status bar */}
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

      {/* Modal para Editar Datos de Usuaria montado en Portal */}
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
                    Editar Datos de Usuaria
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
                  <span>¡Datos actualizados con éxito!</span>
                </div>
              )}

              <form onSubmit={handleEditUserSubmit} className="mt-3 space-y-3 flex-1 overflow-y-auto">
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
