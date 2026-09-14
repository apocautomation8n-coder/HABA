"use client";

import React, { useEffect, useState } from "react";
import { Bell, X, AlertTriangle, TrendingUp, CheckCircle, Sparkles, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/units";

interface NotificationItem {
  id: string;
  type: "price_increase" | "stock_alert" | "system";
  title: string;
  description: string;
  date: string;
  isRead: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    async function loadAlerts() {
      try {
        setLoading(true);

        // Leer preferencia de días desde localStorage (default 15)
        const savedDays = localStorage.getItem("haba_price_review_days");
        const reviewDays = savedDays ? parseInt(savedDays, 10) || 15 : 15;

        // Traer insumos
        const { data: supplies } = await supabase
          .from("supplies")
          .select("id, name, current_price, updated_at")
          .order("updated_at", { ascending: false })
          .limit(50);

        // Traer historial de precios reciente para ver aumentos
        const { data: priceHistory } = await supabase
          .from("supply_price_history")
          .select("supply_id, price, changed_at")
          .order("changed_at", { ascending: false })
          .limit(10);

        const items: NotificationItem[] = [];

        // 1. Alertas de productos que tienen recetas afectadas por aumento de insumos
        const { getOutdatedProductsList } = await import("@/lib/products");
        const outdatedProducts = await getOutdatedProductsList(supabase);

        outdatedProducts.forEach((p) => {
          items.push({
            id: `product-cost-${p.id}`,
            type: "price_increase",
            title: `Revisar costos: ${p.name}`,
            description: `Los insumos de este producto subieron de costo (de ${formatCurrency(p.direct_cost)} a ${formatCurrency(p.currentMaterialsCost)}). Tocá para recalcular.`,
            date: new Date().toISOString(),
            isRead: false,
          });
        });

        // 2. Alertas de aumento de precio de insumos (supply_price_history)
        if (priceHistory && supplies) {
          priceHistory.forEach((hist) => {
            const currentSupply = supplies.find((s) => s.id === hist.supply_id);
            if (currentSupply && currentSupply.current_price > hist.price) {
              const diff = currentSupply.current_price - hist.price;
              items.push({
                id: `price-${hist.supply_id}-${hist.changed_at || (hist as any).date}`,
                type: "price_increase",
                title: `Aumento en: ${currentSupply.name}`,
                description: `Subió ${formatCurrency(diff)} (Nuevo precio: ${formatCurrency(currentSupply.current_price)}). Revisá el costo de tus productos.`,
                date: hist.changed_at || (hist as any).date || new Date().toISOString(),
                isRead: false,
              });
            }
          });
        }

        // 3. Alertas de insumos desactualizados (más de X días sin actualizar precio)
        if (supplies) {
          const now = new Date();
          const thresholdMs = reviewDays * 24 * 60 * 60 * 1000;
          supplies.forEach((supply) => {
            const updatedAt = new Date(supply.updated_at);
            const diffMs = now.getTime() - updatedAt.getTime();
            if (diffMs > thresholdMs) {
              const daysAgo = Math.floor(diffMs / (24 * 60 * 60 * 1000));
              // No duplicar si ya hay alerta de precio para este insumo
              if (!items.find((i) => i.id.includes(supply.id))) {
                items.push({
                  id: `stale-${supply.id}`,
                  type: "stock_alert",
                  title: `Revisá: ${supply.name}`,
                  description: `Hace ${daysAgo} días que no actualizás el precio (último: ${formatCurrency(supply.current_price)}). ¿Sigue vigente?`,
                  date: supply.updated_at,
                  isRead: false,
                });
              }
            }
          });
        }

        // Leer notificaciones ya descartadas o marcadas como leídas de localStorage
        let readIds: string[] = [];
        try {
          const stored = localStorage.getItem("haba_read_notifications");
          if (stored) readIds = JSON.parse(stored);
        } catch {
          // ignore
        }

        // Marcar estado isRead según historial
        const finalItems = items.map((it) => ({
          ...it,
          isRead: readIds.includes(it.id),
        }));

        // Si no hay alertas activas
        if (finalItems.length === 0) {
          finalItems.push({
            id: "system-welcome",
            type: "system",
            title: "¡Todo al día! 🌱",
            description: `Tus costos e insumos están actualizados. HABA te avisará cuando necesiten revisión.`,
            date: new Date().toISOString(),
            isRead: true,
          });
        }

        setNotifications(finalItems);
        if (onCountChange) {
          const unread = finalItems.filter((i) => !i.isRead).length;
          onCountChange(unread);
        }
      } catch (err) {
        console.error("Error loading alerts:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAlerts();
  }, [supabase, onCountChange]);

  const requestNativeNotification = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        new Notification("HABA 🌱", {
          body: "¡Notificaciones activadas! Te avisaremos cuando tus costos o insumos se actualicen.",
          icon: "/icon.svg",
        });
      }
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    localStorage.setItem("haba_read_notifications", JSON.stringify(allIds));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (onCountChange) onCountChange(0);
  };

  const toggleItemRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let readIds: string[] = [];
    try {
      const stored = localStorage.getItem("haba_read_notifications");
      if (stored) readIds = JSON.parse(stored);
    } catch {
      // ignore
    }

    const isCurrentlyRead = notifications.find((n) => n.id === id)?.isRead;
    let newReadIds: string[];
    if (isCurrentlyRead) {
      newReadIds = readIds.filter((item) => item !== id);
    } else {
      newReadIds = Array.from(new Set([...readIds, id]));
    }

    localStorage.setItem("haba_read_notifications", JSON.stringify(newReadIds));
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, isRead: !isCurrentlyRead } : n
    );
    setNotifications(updated);
    const unreadCount = updated.filter((n) => !n.isRead).length;
    if (onCountChange) onCountChange(unreadCount);
  };

  if (!isOpen) return null;

  const unreadTotal = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col border border-[#EAF0E8] animate-in slide-in-from-bottom-6 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-neutral-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-neutral-800">
                  Avisos y Notificaciones
                </h3>
                {unreadTotal > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                    {unreadTotal}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 font-medium">
                Alertas de insumos y costos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadTotal > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-[#1F7A4C] hover:bg-[#DCF4D7] px-2 py-1 rounded-lg transition"
                title="Marcar todas como leídas"
              >
                Leídas
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Permiso de Notificaciones Push del Celular */}
        {notificationPermission !== "granted" && (
          <div className="mx-4 mt-3 p-2.5 bg-[#DCF4D7] border border-[#C3EBC0] rounded-2xl flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Smartphone className="w-4 h-4 text-[#1F7A4C] flex-shrink-0" />
              <p className="text-[11px] text-[#1F7A4C] font-medium leading-tight truncate">
                ¿Avisos directos en tu celular?
              </p>
            </div>
            <button
              onClick={requestNativeNotification}
              className="py-1 px-2.5 bg-[#3BB578] hover:bg-[#2E9E65] text-white text-[10px] font-bold rounded-xl flex-shrink-0 transition"
            >
              Activar
            </button>
          </div>
        )}

        {/* Lista de Notificaciones con scroll independiente */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[140px]">
          {loading ? (
            <p className="text-xs text-neutral-400 text-center py-8">Cargando avisos...</p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition relative ${
                  item.isRead
                    ? "bg-neutral-50/70 border-neutral-200/60 opacity-80"
                    : item.type === "price_increase"
                    ? "bg-rose-50/70 border-rose-200"
                    : item.type === "stock_alert"
                    ? "bg-amber-50/70 border-amber-200"
                    : "bg-neutral-50 border-neutral-100"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    {item.type === "price_increase" ? (
                      <TrendingUp className={`w-4 h-4 ${item.isRead ? "text-neutral-400" : "text-rose-600"}`} />
                    ) : item.type === "stock_alert" ? (
                      <AlertTriangle className={`w-4 h-4 ${item.isRead ? "text-neutral-400" : "text-amber-600"}`} />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-[#3BB578]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className={`text-xs font-bold leading-tight ${item.isRead ? "text-neutral-500 line-through decoration-neutral-300" : "text-neutral-800"}`}>
                          {item.title}
                        </h4>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Nueva" />
                        )}
                      </div>
                      {/* Botón individual de marcar como leída / no leída */}
                      {item.id !== "system-welcome" && (
                        <button
                          type="button"
                          onClick={(e) => toggleItemRead(item.id, e)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-medium transition flex-shrink-0 ${
                            item.isRead
                              ? "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50"
                              : "text-[#1F7A4C] bg-[#DCF4D7] hover:bg-[#C3EBC0]"
                          }`}
                          title={item.isRead ? "Marcar como no leída" : "Marcar como leída"}
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>{item.isRead ? "Leída" : "Marcar"}</span>
                        </button>
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 leading-snug ${item.isRead ? "text-neutral-400" : "text-neutral-600"}`}>
                      {item.description}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-200/40">
                      <span className="text-[9px] text-neutral-400">
                        {new Date(item.date).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {item.type === "price_increase" && item.id.startsWith("product-cost-") && (
                        <a
                          href="/productos"
                          onClick={onClose}
                          className="text-[10px] font-bold text-[#1F7A4C] hover:underline"
                        >
                          Ir a Productos →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer fijo que nunca queda tapado */}
        <div className="p-4 pt-3 border-t border-neutral-100 bg-white flex-shrink-0 space-y-2 pb-[max(env(safe-area-inset-bottom),16px)]">
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={markAllAsRead}
              className="w-full py-2 bg-[#DCF4D7] hover:bg-[#C3EBC0] text-[#1F7A4C] font-bold rounded-2xl text-xs transition"
            >
              Marcar todos como leídos
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-2xl text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
