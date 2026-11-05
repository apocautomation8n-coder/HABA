"use client";

import React, { useState } from "react";
import {
  Search,
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  Mail,
  Calendar,
  Sparkles,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Store,
} from "lucide-react";
import { useModalThemeColor } from "@/hooks/useModalThemeColor";
import { formatDateDisplay } from "@/lib/plan-helpers";

interface OrphanPaymentCandidate {
  userId: string;
  fullName: string;
  businessName: string;
  email: string;
  accountNumber?: string | null;
  planEndDate?: string | null;
  planType?: string | null;
  accountStatus?: string | null;
  alreadyHasThisPayment: boolean;
  matchScore: number;
  matchReasons: string[];
}

interface PaymentInfo {
  id: string;
  status: string;
  status_detail?: string;
  date_created?: string;
  date_approved?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string | null;
  payment_method_id?: string;
  payer: {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    cardholder_name?: string;
  };
}

interface OrphanPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignedSuccess: () => void;
}

export const OrphanPaymentModal: React.FC<OrphanPaymentModalProps> = ({
  isOpen,
  onClose,
  onAssignedSuccess,
}) => {
  useModalThemeColor(isOpen, "#000000");

  const [paymentIdInput, setPaymentIdInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [candidates, setCandidates] = useState<OrphanPaymentCandidate[]>([]);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignSuccessNotice, setAssignSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = paymentIdInput.trim();
    if (!cleanId) {
      setSearchError("Ingresá el ID de operación de Mercado Pago.");
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setPayment(null);
      setCandidates([]);
      setAssignSuccessNotice(null);

      const res = await fetch(`/api/admin/payments/lookup?paymentId=${encodeURIComponent(cleanId)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se encontró el cobro en Mercado Pago.");
      }

      setPayment(data.payment);
      setCandidates(data.candidates || []);
    } catch (err: any) {
      setSearchError(err.message || "Error al consultar la operación.");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async (candidate: OrphanPaymentCandidate) => {
    if (!payment) return;

    const confirmMsg = `¿Confirmás asignar el cobro #${payment.id} ($${payment.transaction_amount}) a la cuenta de "${
      candidate.fullName || candidate.email
    }"?\n\nSe sumarán 30 días de vigencia activa a su plan.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setAssigningUserId(candidate.userId);
      setSearchError(null);

      const res = await fetch("/api/admin/payments/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          targetUserId: candidate.userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo asignar el cobro.");
      }

      setAssignSuccessNotice(
        `¡Pago #${payment.id} asignado con éxito a ${candidate.fullName || candidate.email}! Nueva vigencia: ${formatDateDisplay(
          data.newEndDate
        )}`
      );

      // Actualizar estado local del candidato para marcar que ya tiene el pago
      setCandidates((prev) =>
        prev.map((c) =>
          c.userId === candidate.userId
            ? { ...c, alreadyHasThisPayment: true, planEndDate: data.newEndDate, accountStatus: "active" }
            : c
        )
      );

      onAssignedSuccess();
    } catch (err: any) {
      setSearchError(err.message || "Error al asignar la operación.");
    } finally {
      setAssigningUserId(null);
    }
  };

  const payerName =
    payment?.payer?.cardholder_name ||
    `${payment?.payer?.first_name || ""} ${payment?.payer?.last_name || ""}`.trim() ||
    "No informado";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-neutral-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-orphan-payments-title"
      >
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-orphan-payments-title" className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                <span>Resolución Asistida de Pagos Huérfanos</span>
                <span className="text-[10px] bg-[#DCF4D7] text-[#1F7A4C] font-extrabold px-2 py-0.5 rounded-full">
                  Mercado Pago
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500">
                Buscá por N° de Operación para cruzar los datos del pagador y sugerir la cuenta correcta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-200/60 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario de Búsqueda */}
        <div className="p-4 border-b border-neutral-100 bg-white">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={paymentIdInput}
                onChange={(e) => setPaymentIdInput(e.target.value)}
                placeholder="Pegá el N° de Operación de MP (ej: 185634306746 o 9472619482)"
                disabled={searching}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:border-[#3BB578] focus:ring-2 focus:ring-[#DCF4D7] outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !paymentIdInput.trim()}
              className="py-2.5 px-4 bg-[#1F7A4C] hover:bg-[#185E3B] active:scale-95 text-white text-xs font-bold rounded-2xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {searching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Consultando MP...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Consultar en MP</span>
                </>
              )}
            </button>
          </form>

          {/* Mensajes de error o éxito */}
          {searchError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{searchError}</span>
            </div>
          )}

          {assignSuccessNotice && (
            <div className="mt-3 p-3 bg-[#EBF8F0] border border-[#BCE7CA] rounded-2xl text-[#1F7A4C] text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{assignSuccessNotice}</span>
            </div>
          )}
        </div>

        {/* Contenido con scroll */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Ficha de Detalles del Cobro en Mercado Pago */}
          {payment && (
            <div className="p-4 bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] border border-neutral-200 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-neutral-600" />
                  <span className="text-xs font-bold text-neutral-800">
                    Operación #{payment.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      payment.status === "approved"
                        ? "bg-[#DCF4D7] text-[#1F7A4C] border border-[#C3EBC0]"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {payment.status === "approved" ? "Aprobado" : payment.status}
                  </span>
                </div>
                <div className="text-xs font-extrabold text-[#1F7A4C] bg-white px-2.5 py-1 rounded-xl border border-neutral-200 shadow-2xs">
                  ${payment.transaction_amount?.toLocaleString("es-AR")} {payment.currency_id || "ARS"}
                </div>
              </div>

              {/* Grilla con datos del pagador */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
                    Titular / Pagador
                  </span>
                  <span className="font-bold text-neutral-800 block truncate" title={payerName}>
                    {payerName}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
                    Email en Mercado Pago
                  </span>
                  <span
                    className="font-bold text-neutral-800 block truncate"
                    title={payment.payer?.email || "Sin email"}
                  >
                    {payment.payer?.email || "No provisto"}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
                    Fecha Acreditación
                  </span>
                  <span className="font-bold text-neutral-800 block">
                    {formatDateDisplay(payment.date_approved || payment.date_created)}
                  </span>
                </div>
              </div>

              {payment.external_reference && (
                <div className="text-[11px] text-neutral-600 flex items-center gap-1.5 pt-1">
                  <span className="font-bold">external_reference:</span>
                  <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-mono text-[10px]">
                    {payment.external_reference}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Lista de Candidatas Sugeridas */}
          {payment && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#3BB578]" />
                  <span>Cuentas Candidatas Sugeridas (Cruce Asistido con Supabase)</span>
                </h3>
                <span className="text-[11px] text-neutral-400">
                  {candidates.length} usuarias analizadas
                </span>
              </div>

              {candidates.length === 0 ? (
                <p className="text-xs text-neutral-500 italic p-4 text-center bg-neutral-50 rounded-2xl">
                  No se encontraron usuarias en el sistema.
                </p>
              ) : (
                <div className="space-y-2">
                  {candidates.map((cand) => {
                    const isHighMatch = cand.matchScore >= 40;
                    return (
                      <div
                        key={cand.userId}
                        className={`p-3.5 rounded-2xl border transition text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          cand.alreadyHasThisPayment
                            ? "bg-neutral-50 border-neutral-200 opacity-70"
                            : isHighMatch
                            ? "bg-[#F9FCF8] border-[#BCE7CA] shadow-2xs hover:border-[#3BB578]"
                            : "bg-white border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-neutral-900 text-xs">
                              {cand.fullName}
                            </span>
                            {cand.businessName && (
                              <span className="text-[11px] text-neutral-500">
                                ({cand.businessName})
                              </span>
                            )}
                            {cand.accountNumber && (
                              <span className="font-mono text-[10px] font-bold bg-white text-neutral-700 px-1.5 py-0.5 rounded border border-neutral-200">
                                #{cand.accountNumber}
                              </span>
                            )}

                            {/* Badge de Match Score */}
                            {cand.matchScore > 0 && !cand.alreadyHasThisPayment && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  cand.matchScore >= 70
                                    ? "bg-[#DCF4D7] text-[#1F7A4C]"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {cand.matchScore >= 70 ? "Coincidencia Alta" : "Coincidencia Media"}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-neutral-400" />
                              <span>{cand.email}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-neutral-400" />
                              <span>
                                Vence:{" "}
                                <strong className="text-neutral-700">
                                  {formatDateDisplay(cand.planEndDate)}
                                </strong>
                              </span>
                            </span>
                          </div>

                          {/* Razones del cruce */}
                          {cand.matchReasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {cand.matchReasons.map((reason, idx) => (
                                <span
                                  key={idx}
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                                    reason.includes("YA FUE APLICADO")
                                      ? "bg-amber-100 text-amber-800 font-bold"
                                      : "bg-neutral-100 text-neutral-700"
                                  }`}
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Botón de Asignación */}
                        <div className="shrink-0 flex items-center justify-end">
                          {cand.alreadyHasThisPayment ? (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Ya acreditado</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAssign(cand)}
                              disabled={assigningUserId !== null}
                              className={`py-2 px-3.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs ${
                                isHighMatch
                                  ? "bg-[#1F7A4C] hover:bg-[#185E3B] text-white"
                                  : "bg-neutral-800 hover:bg-neutral-900 text-white"
                              }`}
                            >
                              {assigningUserId === cand.userId ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Asignando...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Asignar (+30 días)</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!payment && !searching && (
            <div className="py-12 text-center text-neutral-400 space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-neutral-300" />
              <p className="text-xs">
                Ingresá el número de operación de Mercado Pago para ver el detalle y sugerencias.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

