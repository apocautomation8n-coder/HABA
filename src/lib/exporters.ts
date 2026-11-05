/**
 * Exportación de listados (insumos, productos, presupuestos) a CSV y PDF.
 * Todo se genera en el navegador con los datos ya cargados y filtrados en pantalla.
 */

export interface ExportColumn<T> {
  header: string;
  /** Valor para el CSV (número o texto sin formato de moneda, para que Excel pueda sumarlo). */
  value: (row: T) => string | number | null | undefined;
  /** Texto para el PDF (por ejemplo con formato de moneda). Si falta, se usa value. */
  display?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
}

export interface ExportSummaryItem {
  label: string;
  value: string;
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nombre de archivo seguro: "haba-insumos-2026-11-05.csv". */
export function buildExportFilename(base: string, extension: string): string {
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `haba-${slug || "listado"}-${todayStamp()}.${extension}`;
}

/**
 * Celda de CSV: entre comillas cuando hace falta y protegida contra fórmulas.
 * Un texto que empieza con = + - @ (por ejemplo un nombre cargado por la usuaria) se abriría
 * en Excel como fórmula; se le antepone un apóstrofo para que quede como texto.
 */
export function toCsvCell(value: string | number | null | undefined, separator = ";"): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!isFinite(value)) return "";
    // Excel en español espera coma decimal cuando el separador es punto y coma
    return separator === ";" ? String(value).replace(".", ",") : String(value);
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (text.includes(separator) || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv<T>(columns: ExportColumn<T>[], rows: T[], separator = ";"): string {
  const header = columns.map((c) => toCsvCell(c.header, separator)).join(separator);
  const lines = rows.map((row) => columns.map((c) => toCsvCell(c.value(row), separator)).join(separator));
  return [header, ...lines].join("\r\n");
}

/** Descarga un CSV listo para abrir en Excel o Google Sheets (UTF-8 con BOM, separador ";"). */
export function downloadCsv<T>(baseName: string, columns: ExportColumn<T>[], rows: T[]): void {
  const csv = buildCsv(columns, rows);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildExportFilename(baseName, "csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Abre el listado como documento A4 con la estética de HABA y el diálogo de impresión,
 * desde donde se guarda como PDF.
 */
export function openPdfReport<T>(options: {
  title: string;
  subtitle?: string;
  businessName?: string | null;
  columns: ExportColumn<T>[];
  rows: T[];
  summary?: ExportSummaryItem[];
}): boolean {
  const { title, subtitle, businessName, columns, rows, summary } = options;
  const win = window.open("", "_blank");
  if (!win) return false;

  const generatedAt = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const head = columns
    .map((c) => `<th style="text-align:${c.align || "left"}">${escapeHtml(c.header)}</th>`)
    .join("");
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${columns
              .map((c) => {
                const v = c.display ? c.display(row) : c.value(row);
                return `<td style="text-align:${c.align || "left"}">${escapeHtml(v)}</td>`;
              })
              .join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${columns.length}" class="empty">No hay registros para mostrar.</td></tr>`;

  const summaryHtml = summary?.length
    ? `<div class="summary">${summary
        .map(
          (s) =>
            `<div class="chip"><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`
        )
        .join("")}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} - HABA</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2B2B2B; margin: 0; font-size: 11px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #3BB578; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 10px; font-weight: 800; letter-spacing: .12em; color: #1F7A4C; text-transform: uppercase; }
  h1 { font-size: 20px; margin: 2px 0 0; }
  .sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
  .meta { text-align: right; color: #6b7280; font-size: 10px; line-height: 1.5; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .chip { background: #DCF4D7; border: 1px solid #C3EBC0; border-radius: 10px; padding: 6px 10px; display: flex; flex-direction: column; }
  .chip span { font-size: 9px; color: #1F7A4C; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .chip strong { font-size: 13px; color: #1F7A4C; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #1F7A4C; color: #fff; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; padding: 7px 8px; }
  thead th:first-child { border-top-left-radius: 8px; }
  thead th:last-child { border-top-right-radius: 8px; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #EAF0E8; vertical-align: top; word-break: break-word; }
  tbody tr:nth-child(even) td { background: #F6F7F2; }
  tr { page-break-inside: avoid; }
  .empty { text-align: center; color: #9ca3af; padding: 24px; }
  footer { margin-top: 16px; color: #9ca3af; font-size: 9px; text-align: center; }
  @media screen { body { padding: 64px 24px 24px; max-width: 1100px; margin: 0 auto; } }
  @media print { .no-print { display: none; } }
  .no-print { position: fixed; top: 12px; right: 12px; background: #3BB578; color: #fff; border: 0; border-radius: 12px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Guardar como PDF</button>
  <header>
    <div>
      <div class="brand">${escapeHtml(businessName || "HABA")}</div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
    </div>
    <div class="meta">Generado el ${escapeHtml(generatedAt)}<br/>${rows.length} ${rows.length === 1 ? "registro" : "registros"}</div>
  </header>
  ${summaryHtml}
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <footer>Generado con HABA</footer>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
