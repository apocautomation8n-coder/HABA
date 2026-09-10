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
        // Traer insumos
        const { data: supplies } = await supabase
          .from("supplies")
          .select("id, name, current_price, updated_at")
          .order("updated_at", { ascending: false })
          .limit(10);

        // Traer historial de precios reciente para ver aumentos
        const { data: priceHistory } = await supabase
          .from("supply_price_history")
          .select("supply_id, price, changed_at")
          .order("changed_at", { ascending: false })
          .limit(10);

        const items: NotificationItem[] = [];

        if (priceHistory && supplies) {
          priceHistory.forEach((hist) => {
            const currentSupply = supplies.find((s) => s.id === hist.supply_id);
            if (currentSupply && currentSupply.current_price > hist.price) {
              const diff = currentSupply.current_price - hist.price;
              items.push({
                id: `price-${hist.supply_id}-${hist.changed_at}`,
                type: "price_increase",
                title: `Aumento en: ${currentSupply.name}`,
                description: `Subió ${formatCurrency(diff)} (Nuevo precio: ${formatCurrency(currentSupply.current_price)}). Revisá el costo de tus recetas.`,
                date: hist.changed_at,
                isRead: false,
              });
            }
          });
        }

        // Si no hay alertas de precio, agregar mensaje informativo de bienvenida
        if (items.length === 0) {
          items.push({
            id: "system-welcome",
            type: "system",
            title: "Control de Stock e Insumos Activo",
            description: "HABA te notificará automáticamente cuando un insumo aumente de precio o cuando tus productos necesiten actualización de costos.",
            date: new Date().toISOString(),
            isRead: true,
          });
        }

        setNotifications(items);
        if (onCountChange) {
          const unread = items.filter((i) => !i.isRead).length;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto border border-[#eef2eb] animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800">
                Avisos y Notificaciones
              </h3>
              <p className="text-[10px] text-neutral-400 font-medium">
                Alertas de insumos y costos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permiso de Notificaciones Push del Celular */}
        {notificationPermission !== "granted" && (
          <div className="mt-3 p-3 bg-[#e5f2e6] border border-[#cce5ce] rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#306236] flex-shrink-0" />
              <p className="text-[11px] text-[#2a4f2f] font-medium leading-tight">
                ¿Querés recibir avisos directos en tu celu?
              </p>
            </div>
            <button
              onClick={requestNativeNotification}
              className="py-1 px-2.5 bg-[#3b7c42] hover:bg-[#326b38] text-white text-[10px] font-bold rounded-xl flex-shrink-0 transition"
            >
              Activar
            </button>
          </div>
        )}

        {/* Lista de Notificaciones */}
        <div className="mt-4 space-y-2.5">
          {loading ? (
            <p className="text-xs text-neutral-400 text-center py-6">Cargando avisos...</p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition ${
                  item.type === "price_increase"
                    ? "bg-rose-50/70 border-rose-200"
                    : "bg-neutral-50 border-neutral-100"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {item.type === "price_increase" ? (
                      <TrendingUp className="w-4 h-4 text-rose-600" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-[#3b7c42]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-neutral-800 leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-neutral-600 mt-1 leading-snug">
                      {item.description}
                    </p>
                    <span className="text-[9px] text-neutral-400 mt-1 block">
                      {new Date(item.date).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-2xl text-xs transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
