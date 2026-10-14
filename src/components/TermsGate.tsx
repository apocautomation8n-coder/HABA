"use client";

import React, { useEffect, useState } from "react";
import { ScrollText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isTermsEnabled, needsTermsAcceptance, TERMS_VERSION } from "@/lib/terms";

/**
 * Bloquea el uso de la app hasta que la usuaria acepte la versión vigente
 * de las bases y condiciones. No hace nada mientras los términos no estén activados.
 */
export function TermsGate() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTermsEnabled()) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user && needsTermsAcceptance(data.user.user_metadata)) {
        setOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const handleAccept = async () => {
    if (!checked || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      },
    });
    setSaving(false);
    if (updateError) {
      setError("No pudimos guardar tu aceptación. Revisá tu conexión e intentá de nuevo.");
      return;
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <h2 id="terms-gate-title" className="font-display text-lg font-bold text-[#2B2B2B]">
            Bases y condiciones
          </h2>
        </div>

        <p className="text-sm text-neutral-600 leading-relaxed mb-4">
          Para seguir usando HABA necesitamos que leas y aceptes las bases y condiciones de uso.
        </p>

        <a
          href="/terminos"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2.5 px-4 rounded-2xl border border-[#CDEBD3] bg-[#F6FBF7] text-[#1F7A4C] text-sm font-bold hover:bg-[#EEF8F1] transition mb-4"
        >
          Leer bases y condiciones
        </a>

        <label className="flex items-start gap-2.5 text-sm text-neutral-700 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#3BB578] flex-shrink-0"
          />
          <span>Leí y acepto las bases y condiciones de HABA.</span>
        </label>

        {error && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAccept}
          disabled={!checked || saving}
          className="w-full py-3 px-4 rounded-2xl bg-[#3BB578] hover:bg-[#33A36B] text-white text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}
