const LS_KEY      = "xenox_local_sheet_data";
const COL_ROWS_KEY = "xenox_col_rows";
const NAME_KEY     = "xenox_sheet_name";
const MAX_COLS = 8;
const MAX_ROWS_PER_COL = 1200;
const MAX_CELL_CHARS = 400;
const MAX_EXPORT_ROWS = 1200;

export type LocalSheet = Record<string, string[]>;

function trimCell(value: string): string {
  return value.trim().slice(0, MAX_CELL_CHARS);
}

function normalizeCol(col: string): string {
  return col.trim().toUpperCase().slice(0, 3) || "A";
}

function normalizeSheet(sheet: LocalSheet): LocalSheet {
  const out: LocalSheet = {};
  for (const col of Object.keys(sheet).slice(0, MAX_COLS)) {
    const safeCol = normalizeCol(col);
    const rows = Array.isArray(sheet[col]) ? sheet[col].slice(0, MAX_ROWS_PER_COL).map((v) => String(v ?? "").slice(0, MAX_CELL_CHARS)) : [];
    while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
    if (rows.length > 0) out[safeCol] = rows;
  }
  return out;
}

// ── Core read/write ───────────────────────────────────────────
export function getSheet(): LocalSheet {
  const w = window as any;
  if (w.XenoxAndroid?.getLocalSheetData) {
    try { return normalizeSheet(JSON.parse(w.XenoxAndroid.getLocalSheetData() || "{}")); } catch {}
  }
  try { return normalizeSheet(JSON.parse(localStorage.getItem(LS_KEY) || "{}")); } catch { return {}; }
}

function save(sheet: LocalSheet) {
  const normalized = normalizeSheet(sheet);
  const value = JSON.stringify(normalized);
  localStorage.setItem(LS_KEY, value);
  try {
    const w = window as any;
    if (w.XenoxAndroid?.saveLocalSheetData) w.XenoxAndroid.saveLocalSheetData(value);
  } catch {}
  window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY, newValue: value }));
}

// ── Sheet name ────────────────────────────────────────────────
export function getSheetName(): string {
  return localStorage.getItem(NAME_KEY) || "Local Sheet";
}
export function setSheetName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim() || "Local Sheet");
  window.dispatchEvent(new StorageEvent("storage", { key: NAME_KEY, newValue: name }));
}

// ── Cell mutations ────────────────────────────────────────────
export function appendToCol(col: string, text: string): number {
  col = normalizeCol(col);
  const sheet = getSheet();
  if (!sheet[col]) sheet[col] = [];
  if (sheet[col].length >= MAX_ROWS_PER_COL) sheet[col].shift();
  sheet[col].push(trimCell(text));
  save(sheet);
  return sheet[col].length;
}

export function deleteLastFromCol(col: string): number {
  col = normalizeCol(col);
  const sheet = getSheet();
  if (!sheet[col] || sheet[col].length === 0) return 0;
  sheet[col].pop();
  if (sheet[col].length === 0) delete sheet[col];
  save(sheet);
  return sheet[col]?.length ?? 0;
}

export function setCell(col: string, rowIdx: number, value: string): void {
  col = normalizeCol(col);
  if (rowIdx < 0 || rowIdx >= MAX_ROWS_PER_COL) return;
  const sheet = getSheet();
  if (!sheet[col]) sheet[col] = [];
  while (sheet[col].length <= rowIdx) sheet[col].push("");
  if (value.trim() === "") {
    sheet[col][rowIdx] = "";
    while (sheet[col].length > 0 && sheet[col][sheet[col].length - 1] === "") sheet[col].pop();
    if (sheet[col].length === 0) delete sheet[col];
  } else {
    sheet[col][rowIdx] = trimCell(value);
  }
  save(sheet);
}

export function getColCount(col: string): number {
  return getSheet()[normalizeCol(col)]?.length ?? 0;
}

// ── Export formats ────────────────────────────────────────────

/**
 * TSV (Tab-Separated Values) — Google Sheets compatible.
 * Rows separated by \n, columns by \t.
 */
export function buildTSV(
  sheet: LocalSheet,
  cols: string[],
  startColIdx: number,
  endColIdx: number,
  startRowIdx: number,
  endRowIdx: number,
): string {
  const rows: string[] = [];
  const safeEndRow = Math.min(endRowIdx, startRowIdx + MAX_EXPORT_ROWS - 1, MAX_ROWS_PER_COL - 1);
  for (let r = startRowIdx; r <= safeEndRow; r++) {
    const cells: string[] = [];
    for (let c = startColIdx; c <= endColIdx; c++) {
      cells.push(sheet[cols[c]]?.[r] ?? "");
    }
    rows.push(cells.join("\t"));
  }
  return rows.join("\n");
}

/**
 * CSV — Excel-compatible (comma-separated, quoted where needed).
 */
export function buildCSV(sheet: LocalSheet, cols: string[]): string {
  const safeCols = cols.slice(0, MAX_COLS);
  const maxRow = Math.min(MAX_EXPORT_ROWS, safeCols.reduce((m, c) => Math.max(m, sheet[c]?.length ?? 0), 0));
  const header = safeCols.join(",");
  const rows: string[] = [header];
  for (let r = 0; r < maxRow; r++) {
    const cells = safeCols.map((col) => {
      const v = sheet[col]?.[r] ?? "";
      return v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    });
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

/**
 * Human-readable text (for Share as text).
 */
export function buildShareText(sheet: LocalSheet, cols: string[], sheetName: string): string {
  const safeCols = cols.slice(0, MAX_COLS);
  const maxRow = Math.min(MAX_EXPORT_ROWS, safeCols.reduce((m, c) => Math.max(m, sheet[c]?.length ?? 0), 0));
  const lines: string[] = [`📋 ${sheetName}\n`];
  const header = ["#", ...safeCols].join("\t");
  lines.push(header);
  for (let r = 0; r < maxRow; r++) {
    const row = [String(r + 1), ...safeCols.map((col) => sheet[col]?.[r] ?? "")].join("\t");
    lines.push(row);
  }
  return lines.join("\n");
}

/**
 * Build a proper XLSX Blob using SheetJS.
 * Data is placed in a grid: col headers in row 1, data below.
 */
export async function buildXLSXBlob(sheet: LocalSheet, cols: string[], sheetName = "Sheet1"): Promise<Blob> {
  const XLSX = await import("xlsx");
  const safeCols = cols.slice(0, MAX_COLS);
  const maxRow = Math.min(MAX_EXPORT_ROWS, safeCols.reduce((m, c) => Math.max(m, sheet[c]?.length ?? 0), 0));
  const aoa: (string | number)[][] = [safeCols];
  for (let r = 0; r < maxRow; r++) {
    aoa.push(safeCols.map((col) => sheet[col]?.[r] ?? ""));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Trigger a browser file download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export type ShareResult =
  | "shared"       // share dialog opened and user shared
  | "cancelled"    // share dialog opened but user cancelled (AbortError)
  | "unsupported"  // navigator.share / canShare not available on this device
  | "failed"       // share supported but threw an unexpected error
  | "empty";       // no data to share

/**
 * Attempt to share an XLSX file.
 * Tries: (1) Android native bridge, (2) Web Share API, (3) unsupported.
 */
export async function shareXLSXFile(
  sheet: LocalSheet,
  cols: string[],
  sheetName: string,
): Promise<ShareResult> {
  const safeCols = cols.slice(0, MAX_COLS);
  const maxRow = Math.min(MAX_EXPORT_ROWS, safeCols.reduce((m, c) => Math.max(m, sheet[c]?.length ?? 0), 0));
  if (maxRow === 0) return "empty";

  const safeName = sheetName.trim().replace(/\s+/g, "_") || "xenox_sheet";
  const filename  = `${safeName}.xlsx`;
  const blob      = await buildXLSXBlob(sheet, safeCols, sheetName);

  // ── 1. Android native share bridge ────────────────────────────────────────
  try {
    const w = window as any;
    if (w.XenoxAndroid?.shareFile) {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const result = w.XenoxAndroid.shareFile(base64, filename, blob.type);
      if (result === true || result === "true" || result === "ok") return "shared";
    }
  } catch {}

  // ── 2. Web Share API ──────────────────────────────────────────────────────
  if (!navigator.share) return "unsupported";

  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: sheetName, text: sheetName });
    return "shared";
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "AbortError") return "cancelled";
    if (name === "TypeError" || name === "NotAllowedError") return "unsupported";
    return "failed";
  }
}

/**
 * Download XLSX file directly to the device (no share dialog).
 * Uses native Android Downloads folder bridge if available (APK), otherwise browser download.
 */
export async function downloadXLSXFile(sheet: LocalSheet, cols: string[], sheetName: string): Promise<void> {
  const safeName = sheetName.trim().replace(/\s+/g, "_") || "xenox_sheet";
  const filename  = `${safeName}.xlsx`;
  const blob      = await buildXLSXBlob(sheet, cols, sheetName);

  // Try native Android download bridge first (saves to Downloads folder)
  try {
    const w = window as any;
    if (w.XenoxAndroid?.downloadFile) {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const result = w.XenoxAndroid.downloadFile(base64, filename, blob.type);
      if (result === true || result === "true") return;
    }
  } catch {}

  downloadBlob(blob, filename);
}

/** Trigger a browser file download */
export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Clear ─────────────────────────────────────────────────────
export function clearSheet() {
  const emptyJson = "{}";
  // Clear localStorage first
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(COL_ROWS_KEY);
  // Clear Android SharedPreferences and explicitly write "{}" to avoid any race condition
  // where getLocalSheetData() is called before the async apply() is visible
  try {
    const w = window as any;
    if (w.XenoxAndroid?.clearLocalSheetData) w.XenoxAndroid.clearLocalSheetData();
    // Also write empty JSON explicitly so getLocalSheetData() returns "{}" immediately
    if (w.XenoxAndroid?.saveLocalSheetData) w.XenoxAndroid.saveLocalSheetData(emptyJson);
  } catch {}
  window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY, newValue: null }));
  window.dispatchEvent(new StorageEvent("storage", { key: COL_ROWS_KEY, newValue: null }));
}

export const LOCAL_SHEET_KEY = LS_KEY;
export const SHEET_NAME_KEY  = NAME_KEY;
export const LOCAL_SHEET_LIMITS = { maxCols: MAX_COLS, maxRowsPerCol: MAX_ROWS_PER_COL, maxCellChars: MAX_CELL_CHARS, maxExportRows: MAX_EXPORT_ROWS };
