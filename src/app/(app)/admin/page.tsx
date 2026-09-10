"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { HabaMascot } from "@/components/HabaMascot";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  business_name?: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

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

      // Validar rol en profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Cargar perfiles
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && profilesData) {
        setUsers(profilesData as UserProfile[]);
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
    const nextState = !targetUser.is_active;
    const actionName = nextState ? "activar" : "apagar (suspender)";
    const confirm = window.confirm(
      `¿Estás segura de ${actionName} la cuenta de "${targetUser.full_name || targetUser.email}"?`
    );
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: nextState })
        .eq("id", targetUser.id);

      if (!error) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextState } : u))
        );
      } else {
        alert("Error al actualizar estado: " + error.message);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Eliminar usuaria definitivamente
  const handleDeleteUser = async (targetUser: UserProfile) => {
    const confirm = window.confirm(
      `¿ELIMINAR DEFINITIVAMENTE a "${targetUser.full_name || targetUser.email}"? Esta acción borrará su cuenta y todos sus datos cargados.`
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
      <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-3">
        <HabaMascot size={70} />
        <h3 className="text-base font-bold text-rose-700">Acceso Restringido</h3>
        <p className="text-xs text-neutral-500">
          Solo la administradora Giulianna (Gio) tiene acceso a este panel de control.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-2 py-2 px-4 bg-neutral-100 text-neutral-700 rounded-2xl text-xs font-semibold"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4 pb-12">
      {/* Header Admin */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/configuracion"
            className="p-2 bg-white hover:bg-neutral-100 text-neutral-600 rounded-2xl border border-neutral-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
              <span>Panel Gio</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                SuperAdmin
              </span>
            </h2>
            <p className="text-xs text-neutral-500">Gestión de altas, apagado y bajas de clientas</p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="py-2.5 px-3.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl shadow-sm transition flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
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
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-neutral-200 rounded-2xl focus:border-[#3BB578] outline-none shadow-sm"
        />
      </div>

      {/* Lista de Usuarias */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-[#EAF0E8] text-center text-xs text-neutral-400">
            No se encontraron clientas registradas.
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              className={`bg-white rounded-3xl p-4 border shadow-sm transition flex flex-col space-y-3 ${
                u.is_active ? "border-[#EAF0E8]" : "border-rose-200 bg-rose-50/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-neutral-800">
                      {u.full_name || "Sin nombre"}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {u.is_active ? "Activa" : "Apagada / Suspendida"}
                    </span>
                    {u.role === "admin" && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{u.email}</p>
                  {u.business_name && (
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Emprendimiento: {u.business_name}
                    </p>
                  )}
                </div>

                {/* Acciones de Gio */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleUserActive(u)}
                    className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                      u.is_active
                        ? "bg-amber-50 hover:bg-amber-100 text-amber-700"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                    }`}
                    title={u.is_active ? "Apagar cuenta" : "Encender cuenta"}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{u.is_active ? "Apagar" : "Activar"}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteUser(u)}
                    className="p-1.5 text-neutral-300 hover:text-rose-600 rounded-xl transition"
                    title="Eliminar usuario definitivamente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal para Crear Usuaria */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#EAF0E8] animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-800">Alta de Nueva Clienta</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Email de acceso *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="clienta@correo.com"
                  required
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Contraseña inicial *</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Nombre de la clienta</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ej: Laura Pérez"
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Nombre del negocio</label>
                <input
                  type="text"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="Ej: Creaciones Laura"
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2 px-3 bg-neutral-100 text-neutral-700 rounded-2xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 py-2 px-3 bg-[#3BB578] hover:bg-[#2E9E65] text-white rounded-2xl text-xs font-bold shadow-sm disabled:opacity-60"
                >
                  {creatingUser ? "Creando..." : "Crear Usuaria"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
