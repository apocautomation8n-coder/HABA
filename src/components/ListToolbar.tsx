"use client";

import React, { useEffect, useRef, useState } from "react";
import { LayoutGrid, List, Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

export type ViewMode = "grid" | "list";

/** Vista grilla o lista recordada por sección en este navegador. */
export function useViewMode(storageKey: string, defaultMode: ViewMode = "grid") {
  const key = `haba_view_mode_${storageKey}`;
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "grid" || saved === "list") setMode(saved);
    } catch {
      // ignore
    }
  }, [key]);

  const update = (next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // ignore
    }
  };

  return [mode, update] as const;
}

/** Selector de vista estilo píldora: lista a la izquierda, grilla a la derecha. */
export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const base =
    "h-9 px-3.5 flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3BB578] focus-visible:ring-inset";
  return (
    <div
      role="group"
      aria-label="Modo de vista"
      className="inline-flex rounded-full border border-[#C3EBC0] bg-white overflow-hidden shadow-sm flex-shrink-0"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={mode === "list"}
        title="Ver como lista"
        className={`${base} rounded-l-full ${
          mode === "list" ? "bg-[#3BB578] text-white" : "text-[#1F7A4C] hover:bg-[#F6F7F2]"
        }`}
      >
        <List className="w-4 h-4" />
        <span className="sr-only">Lista</span>
      </button>
      <span className="w-px bg-[#C3EBC0]" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={mode === "grid"}
        title="Ver como grilla"
        className={`${base} rounded-r-full ${
          mode === "grid" ? "bg-[#3BB578] text-white" : "text-[#1F7A4C] hover:bg-[#F6F7F2]"
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="sr-only">Grilla</span>
      </button>
    </div>
  );
}

/** Botón "Exportar" con opciones CSV (Excel) y PDF. */
export function ExportMenu({
  onCsv,
  onPdf,
  disabled,
}: {
  onCsv: () => void;
  onPdf: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-[#F6F7F2] transition text-left";

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 px-3 bg-white border border-[#C3EBC0] text-[#1F7A4C] hover:bg-[#F6F7F2] disabled:opacity-50 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
      >
        <Download className="w-4 h-4" />
        <span>Exportar</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-52 bg-white border border-[#EAF0E8] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onCsv();
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#3BB578]" />
            <span>
              CSV <span className="font-normal text-neutral-400">(Excel / Sheets)</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${item} border-t border-neutral-100`}
            onClick={() => {
              setOpen(false);
              onPdf();
            }}
          >
            <FileText className="w-4 h-4 text-[#3BB578]" />
            <span>PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}
