import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Check, Trash2, Copy, X, MoreVertical,
  Download, Share2, Pencil, FileSpreadsheet,
  Scissors, ClipboardPaste,
} from "lucide-react";
import {
  getSheet, clearSheet, setCell,
  buildTSV, shareXLSXFile, downloadXLSXFile,
  getSheetName, setSheetName,
  LOCAL_SHEET_KEY, SHEET_NAME_KEY,
  buildCSV, downloadFile,
  LOCAL_SHEET_LIMITS,
  type LocalSheet,
} from "@/lib/localSheet";
import { getPerformanceMode } from "@/lib/performanceMode";

// ── Config helpers ────────────────────────────────────────────
const CFG_KEY      = "xenox_float_config";
const COL_ROWS_KEY = "xenox_col_rows";
const HANDLE_R     = 13;   // drag-handle radius px

function getConfigCols(): string[] {
  try {
    const cfg = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
    if (cfg?.columns)
      return cfg.columns.split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean).slice(0, LOCAL_SHEET_LIMITS.maxCols);
  } catch {}
  return ["A", "B", "C"];
}

function buildCols(sheet: LocalSheet, configCols: string[]): string[] {
  const all = new Set([...configCols, ...Object.keys(sheet)]);
  return [...all].sort().slice(0, LOCAL_SHEET_LIMITS.maxCols);
}

// ── Types ─────────────────────────────────────────────────────
type CellPos   = { colIdx: number; rowIdx: number };
type Selection = { start: CellPos; end: CellPos } | null;

function normSel(sel: Selection) {
  if (!sel) return null;
  return {
    minC: Math.min(sel.start.colIdx, sel.end.colIdx),
    maxC: Math.max(sel.start.colIdx, sel.end.colIdx),
    minR: Math.min(sel.start.rowIdx, sel.end.rowIdx),
    maxR: Math.max(sel.start.rowIdx, sel.end.rowIdx),
  };
}

function inSel(colIdx: number, rowIdx: number, ns: ReturnType<typeof normSel>) {
  if (!ns) return false;
  return colIdx >= ns.minC && colIdx <= ns.maxC && rowIdx >= ns.minR && rowIdx <= ns.maxR;
}

// ── Constants & Palette ────────────────────────────────────────
const ROW_H      = 25;
const ROW_NUM_W  = 34;
const MIN_ROWS   = 50;

const C = {
  bg:         "#080808",
  headerRowBg:"#282828",
  rowNumBg:   "#1c1c1c",
  cornerBg:   "#242424",
  appBarBg:   "#141414",
  fxBarBg:    "#141414",
  lineH:      "rgba(255,255,255,0.13)",
  lineV:      "rgba(255,255,255,0.13)",
  lineHdr:    "rgba(255,255,255,0.26)",
  lineRowNum: "rgba(255,255,255,0.20)",
  colHdrText: "rgba(255,255,255,0.65)",
  rowNumText: "rgba(255,255,255,0.38)",
  selColBg:   "#5a1c1c",
  selColText: "#faa0a0",
  selFill:    "rgba(160,55,55,0.22)",
  selHandle:  "#e05050",
  selOutline: "#bf5555",
  cellText:   "rgba(255,255,255,0.92)",
};

// ── Component ─────────────────────────────────────────────────
export default function LocalSheet() {
  const lightweight = getPerformanceMode().safeMode;
  // ── Data state ─────────────────────────────────────────────
  const [sheet,       setSheet]       = useState<LocalSheet>({});
  const [configCols,  setConfigCols]  = useState<string[]>(["A", "B", "C"]);
  const [sheetTitle,  setSheetTitle]  = useState(getSheetName());

  // ── Selection ──────────────────────────────────────────────
  const [selection, setSelection] = useState<Selection>(null);
  const draggingHandle = useRef<"tl" | "br" | null>(null);

  // ── Fx bar ─────────────────────────────────────────────────
  const [fxValue, setFxValue] = useState("");
  const [fxDirty, setFxDirty] = useState(false);
  const fxInputRef = useRef<HTMLInputElement>(null);

  // ── Menus / dialogs ────────────────────────────────────────
  const [clearState,   setClearState]   = useState<"idle" | "confirm">("idle");
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [exportMenu,   setExportMenu]   = useState(false);
  const [renaming,     setRenaming]     = useState(false);
  const [renameVal,    setRenameVal]    = useState("");
  const [toast,        setToast]        = useState("");

  // ── Cell action menu ───────────────────────────────────────
  const [cellMenu, setCellMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTappedCell = useRef<string | null>(null);

  // ── Layout ─────────────────────────────────────────────────
  const [cellW,  setCellW]  = useState(110);
  const [scrollTop, setScrollTop] = useState(0);
  const gridWrap  = useRef<HTMLDivElement>(null);
  const gridContent = useRef<HTMLDivElement>(null);
  const scrollRaf = useRef<number | null>(null);

  // ── Load & sync ────────────────────────────────────────────
  const reload = useCallback(() => {
    setSheet(getSheet());
    setConfigCols(getConfigCols());
    setSheetTitle(getSheetName());
  }, []);

  useEffect(() => {
    reload();
    const onStorage = (e: StorageEvent) => {
      // Use the event's newValue directly for sheet data — avoids stale Android bridge reads
      if (e.key === LOCAL_SHEET_KEY && e.newValue) {
        try {
          setSheet(JSON.parse(e.newValue) as LocalSheet);
        } catch { reload(); }
        return;
      }
      if ([LOCAL_SHEET_KEY, CFG_KEY, COL_ROWS_KEY, SHEET_NAME_KEY, null].includes(e.key as any))
        reload();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("xenox:local-sheet-updated", reload);

    // Bug 3 fix: poll for cross-WebView changes — the storage event is unreliable
    // between two separate Android WebView instances even on the same origin.
    let lastRaw = localStorage.getItem(LOCAL_SHEET_KEY) ?? "";
    const pollId = setInterval(() => {
      const current = localStorage.getItem(LOCAL_SHEET_KEY) ?? "";
      if (current !== lastRaw) {
        lastRaw = current;
        reload();
      }
    }, 900);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("xenox:local-sheet-updated", reload);
      clearInterval(pollId);
    };
  }, [reload]);

  // ── Derived ────────────────────────────────────────────────
  const cols       = buildCols(sheet, configCols);
  const dataMaxRow = Math.min(LOCAL_SHEET_LIMITS.maxRowsPerCol, cols.reduce((m, c) => Math.max(m, sheet[c]?.length ?? 0), 0));
  const visRows    = Math.max(dataMaxRow + 15, MIN_ROWS);
  const hasData    = dataMaxRow > 0;
  const ns         = normSel(selection);

  // Single-cell selection?
  const isSingleCell = ns ? ns.minC === ns.maxC && ns.minR === ns.maxR : false;
  const fxCellLabel  = ns ? (
    isSingleCell
      ? `${cols[ns.minC]}${ns.minR + 1}`
      : `${cols[ns.minC]}${ns.minR + 1}:${cols[ns.maxC]}${ns.maxR + 1}`
  ) : "";

  // ── Responsive cell width ──────────────────────────────────
  useLayoutEffect(() => {
    const calc = () => {
      const total = gridWrap.current?.clientWidth ?? window.innerWidth;
      const next = Math.max(80, Math.floor((total - ROW_NUM_W) / (cols.length || 3)));
      setCellW((prev) => (prev === next ? prev : next));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [cols.length]);

  const visibleRange = useMemo(() => {
    const viewport = gridWrap.current?.clientHeight || window.innerHeight;
    const overscan = lightweight ? 4 : 8;
    const start = Math.max(0, Math.floor(Math.max(0, scrollTop - ROW_H) / ROW_H) - overscan);
    const count = Math.ceil(viewport / ROW_H) + overscan * 2 + 2;
    const end = Math.min(visRows, start + count);
    return { start, end };
  }, [scrollTop, visRows, lightweight]);

  const visibleRows = useMemo(
    () => Array.from({ length: visibleRange.end - visibleRange.start }, (_, i) => visibleRange.start + i),
    [visibleRange.start, visibleRange.end],
  );

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const nextTop = e.currentTarget.scrollTop;
    if (scrollRaf.current !== null) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      setScrollTop((prev) => (Math.abs(prev - nextTop) < ROW_H ? prev : nextTop));
    });
  }, []);

  // ── Handle drag: touch move on grid wrapper ────────────────
  const handleGridTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggingHandle.current || !selection) return;
    e.preventDefault();
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
    const cell = el?.closest("[data-ci]") as HTMLElement | null;
    if (!cell) return;
    const ci = parseInt(cell.dataset.ci ?? "0");
    const ri = parseInt(cell.dataset.ri ?? "0");
    const ns_ = normSel(selection)!;
    if (draggingHandle.current === "tl") {
      setSelection({ start: { colIdx: ci, rowIdx: ri }, end: { colIdx: ns_.maxC, rowIdx: ns_.maxR } });
    } else {
      setSelection({ start: { colIdx: ns_.minC, rowIdx: ns_.minR }, end: { colIdx: ci, rowIdx: ri } });
    }
  }, [selection]);

  useEffect(() => {
    const up = () => { draggingHandle.current = null; };
    window.addEventListener("touchend", up);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("touchend", up);
      window.removeEventListener("mouseup", up);
      if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Cell tap ──────────────────────────────────────────────
  const handleCellTap = (colIdx: number, rowIdx: number, e: React.MouseEvent | React.TouchEvent) => {
    const cellKey = `${colIdx}:${rowIdx}`;
    const currentSel = normSel(selection);
    const alreadySelected = currentSel
      ? inSel(colIdx, rowIdx, currentSel)
      : false;

    if (alreadySelected && lastTappedCell.current === cellKey) {
      // Second tap on same cell → open action menu
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setCellMenu({ x: rect.left, y: rect.bottom + window.scrollY });
      lastTappedCell.current = null;
    } else {
      setCellMenu(null);
      setSelection({ start: { colIdx, rowIdx }, end: { colIdx, rowIdx } });
      const val = sheet[cols[colIdx]]?.[rowIdx] ?? "";
      setFxValue(val);
      setFxDirty(false);
      lastTappedCell.current = cellKey;
    }
  };

  // ── Long press open menu ───────────────────────────────────
  const handleCellLongPressStart = (colIdx: number, rowIdx: number, e: React.TouchEvent) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    // Capture touch position at start (touches array may be empty later)
    const touchX = e.touches[0]?.clientX ?? 0;
    const touchY = e.touches[0]?.clientY ?? 0;
    longPressTimer.current = setTimeout(() => {
      const currentNs = normSel(selection);
      const insideExistingRange = currentNs ? inSel(colIdx, rowIdx, currentNs) : false;
      if (insideExistingRange) {
        // Already have a range — just open the menu at touch position
        setCellMenu({ x: touchX, y: touchY + 10 });
      } else {
        // Select this single cell and open menu
        setSelection({ start: { colIdx, rowIdx }, end: { colIdx, rowIdx } });
        const val = sheet[cols[colIdx]]?.[rowIdx] ?? "";
        setFxValue(val);
        setFxDirty(false);
        setCellMenu({ x: touchX, y: touchY + 10 });
      }
      longPressTimer.current = null;
    }, 500);
  };

  const handleCellLongPressEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // ── Cut ───────────────────────────────────────────────────
  const handleCut = async () => {
    if (!ns) return;
    const text = buildTSV(sheet, cols, ns.minC, ns.maxC, ns.minR, ns.maxR);
    try { await navigator.clipboard.writeText(text); } catch {}
    // Clear the range
    const fresh = getSheet();
    for (let c = ns.minC; c <= ns.maxC; c++) {
      for (let r = ns.minR; r <= ns.maxR; r++) {
        const col = cols[c];
        if (fresh[col]) {
          fresh[col][r] = "";
          while (fresh[col].length > 0 && fresh[col][fresh[col].length - 1] === "") fresh[col].pop();
          if (fresh[col].length === 0) delete fresh[col];
        }
      }
    }
    localStorage.setItem(LOCAL_SHEET_KEY, JSON.stringify(fresh));
    reload();
    setCellMenu(null);
    showToast("✂ Cut to clipboard");
  };

  // ── Paste ─────────────────────────────────────────────────
  const handlePaste = async () => {
    if (!ns) return;
    let text = "";
    // Try native Android bridge first (reliable in WebView)
    try {
      const w = window as any;
      if (w.XenoxAndroid?.readClipboard) {
        text = w.XenoxAndroid.readClipboard() || "";
      }
    } catch {}
    // Fallback to browser clipboard API
    if (!text) {
      try { text = await navigator.clipboard.readText(); } catch {}
    }
    if (!text) { showToast("❌ Clipboard is empty"); return; }
    const lines = text.split("\n").slice(0, lightweight ? 80 : 250).map((l) => l.split("\t").slice(0, cols.length));
    const startCol = ns.minC;
    const startRow = ns.minR;
    for (let r = 0; r < lines.length; r++) {
      for (let c = 0; c < lines[r].length; c++) {
        const colIdx2 = startCol + c;
        if (colIdx2 < cols.length) setCell(cols[colIdx2], startRow + r, lines[r][c]);
      }
    }
    reload();
    setCellMenu(null);
    showToast("📋 Pasted");
  };

  // ── Fx bar ────────────────────────────────────────────────
  const handleFxConfirm = () => {
    if (!ns || !isSingleCell) return;
    setCell(cols[ns.minC], ns.minR, fxValue);
    reload();
    setFxDirty(false);
    setSelection(null);
    setFxValue("");
  };

  const handleFxDismiss = () => { setSelection(null); setFxValue(""); setFxDirty(false); };

  // ── Clear ─────────────────────────────────────────────────
  const handleClear = () => {
    clearSheet();
    setClearState("idle");
    setSelection(null);
    setFxValue("");
    // Directly reset sheet state to empty — avoids any SharedPreferences timing issues on Android
    setSheet({});
    setConfigCols(getConfigCols());
  };

  // ── Copy (TSV) ────────────────────────────────────────────
  const handleCopy = async () => {
    const text = ns
      ? buildTSV(sheet, cols, ns.minC, ns.maxC, ns.minR, ns.maxR)
      : buildTSV(sheet, cols, 0, cols.length - 1, 0, dataMaxRow - 1);
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("✓ Copied as spreadsheet data");
    } catch { showToast("❌ Copy failed"); }
  };

  // ── Export CSV ────────────────────────────────────────────
  const handleExportCSV = () => {
    const csv = buildCSV(sheet, cols);
    downloadFile(csv, `${sheetTitle.replace(/\s+/g, "_")}.csv`, "text/csv;charset=utf-8;");
    showToast("✓ CSV downloaded");
    setExportMenu(false); setMenuOpen(false);
  };

  // ── Share as File (real system share dialog) ──────────────
  const handleShareFile = async () => {
    setExportMenu(false); setMenuOpen(false);
    if (dataMaxRow === 0) { showToast("❌ No data to share"); return; }
    let result: Awaited<ReturnType<typeof shareXLSXFile>>;
    try {
      result = await shareXLSXFile(sheet, cols, sheetTitle);
    } catch {
      result = "failed";
    }
    if (result === "shared") {
      showToast("✓ File shared");
    } else if (result === "cancelled") {
      // User dismissed the share dialog — no message needed
    } else if (result === "unsupported") {
      showToast("⚠️ File sharing not supported on this browser. Downloading instead.");
      try { await downloadXLSXFile(sheet, cols, sheetTitle); } catch { showToast("❌ Export failed"); }
    } else if (result === "failed") {
      showToast("⚠️ Share failed. Downloading instead.");
      try { await downloadXLSXFile(sheet, cols, sheetTitle); } catch { showToast("❌ Export failed"); }
    } else {
      showToast("❌ No data to share");
    }
  };

  // ── Download Excel (.xlsx) ────────────────────────────────
  const handleDownloadExcel = async () => {
    if (dataMaxRow === 0) { showToast("❌ No data to download"); setExportMenu(false); setMenuOpen(false); return; }
    try {
      await downloadXLSXFile(sheet, cols, sheetTitle);
      showToast("✓ Excel file downloaded");
    } catch {
      // Fallback to CSV
      try {
        const csv = buildCSV(sheet, cols);
        const safeName = sheetTitle.replace(/\s+/g, "_") || "xenox_sheet";
        downloadFile(csv, `${safeName}.csv`, "text/csv;charset=utf-8;");
        showToast("✓ CSV downloaded");
      } catch {
        showToast("❌ Download failed");
      }
    }
    setExportMenu(false); setMenuOpen(false);
  };

  // ── Rename ────────────────────────────────────────────────
  const openRename = () => { setRenameVal(sheetTitle); setRenaming(true); setMenuOpen(false); };
  const confirmRename = () => {
    const n = renameVal.trim() || "Local Sheet";
    setSheetName(n); setSheetTitle(n); setRenaming(false);
  };

  // ── Toast ─────────────────────────────────────────────────
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  // ── Drag handle positions (within grid content div) ────────
  const handleTL = ns ? {
    left: ROW_NUM_W + ns.minC * cellW - HANDLE_R,
    top:  ROW_H + ns.minR * ROW_H - HANDLE_R,
  } : null;
  const handleBR = ns ? {
    left: ROW_NUM_W + (ns.maxC + 1) * cellW - HANDLE_R,
    top:  ROW_H + (ns.maxR + 1) * ROW_H - HANDLE_R,
  } : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: C.bg, color: "#e0e0e0", overflow: "hidden", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}
      onClick={() => { if (menuOpen) setMenuOpen(false); if (exportMenu) setExportMenu(false); if (cellMenu) setCellMenu(null); }}
    >

      {/* ══ APP HEADER ══════════════════════════════════════ */}
      <div style={{ background: C.appBarBg, borderBottom: `1px solid ${C.lineHdr}`, display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", flexShrink: 0, zIndex: 40 }}>

        <Link href="/">
          <button style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={14} color="rgba(255,255,255,0.45)" />
          </button>
        </Link>

        {/* Sheet title */}
        <div style={{ marginRight: "auto", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sheetTitle}
          </div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 2 }}>
            Xenox App Sheet Mode
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(160,60,60,0.13)", border: "1px solid rgba(160,60,60,0.28)", color: "#d88080", flexShrink: 0, whiteSpace: "nowrap" }}>
          {cols.length}C · {dataMaxRow}R
          {ns && ` · ${ns.maxC - ns.minC + 1}×${ns.maxR - ns.minR + 1}`}
        </div>

        {/* Copy */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: ns ? "rgba(160,55,55,0.2)" : "rgba(120,80,220,0.14)", border: `1px solid ${ns ? "rgba(180,70,70,0.4)" : "rgba(120,80,220,0.32)"}`, color: ns ? "#faa0a0" : "#b8a0f8", cursor: "pointer", flexShrink: 0 }}
        >
          <Copy size={11} />
          {ns ? `Copy ${cols[ns.minC]}${ns.minR + 1}${isSingleCell ? "" : `:${cols[ns.maxC]}${ns.maxR + 1}`}` : "Copy"}
        </button>

        {/* Clear */}
        {clearState === "idle" ? (
          <button
            onClick={(e) => { e.stopPropagation(); setClearState("confirm"); }}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "rgba(220,60,60,0.1)", border: "1px solid rgba(220,60,60,0.25)", color: "#f07070", cursor: "pointer", flexShrink: 0 }}
          >
            <Trash2 size={11} />
            Clear
          </button>
        ) : (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>Clear all?</span>
            <button onClick={(e) => { e.stopPropagation(); handleClear(); }} style={{ padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#a01818,#e04040)", border: "none", color: "#fff", cursor: "pointer" }}>Yes</button>
            <button onClick={(e) => { e.stopPropagation(); setClearState("idle"); }} style={{ padding: "4px 9px", borderRadius: 6, fontSize: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>No</button>
          </div>
        )}

        {/* 3-dot menu */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); setExportMenu(false); }}
            style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: menuOpen ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
          >
            <MoreVertical size={14} color="rgba(255,255,255,0.55)" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: "absolute", top: 36, right: 0, background: "#222", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.55)", zIndex: 200, minWidth: 170, overflow: "hidden" }}
            >
              {/* Rename Sheet */}
              <button
                onClick={() => openRename()}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "transparent", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", textAlign: "left" }}
              >
                <Pencil size={14} color="#a0a0a0" />
                Rename Sheet
              </button>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 10px" }} />
              {/* Share & Export */}
              <button
                onClick={(e) => { e.stopPropagation(); setExportMenu((v) => !v); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: exportMenu ? "rgba(255,255,255,0.06)" : "transparent", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", textAlign: "left" }}
              >
                <Share2 size={14} color="#a0a0a0" />
                Share & Export
              </button>

              {exportMenu && (
                <div style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Share as File — opens system share dialog */}
                  <button
                    onClick={handleShareFile}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer", textAlign: "left" }}
                  >
                    <Share2 size={12} color="#80a0ff" />
                    Share as File
                  </button>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />
                  {/* Download Excel — saves file directly */}
                  <button
                    onClick={handleDownloadExcel}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer", textAlign: "left" }}
                  >
                    <Download size={12} color="#7080a0" />
                    Download Excel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: "#3b1a6e", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 16px", borderRadius: 20, boxShadow: "0 4px 18px rgba(59,26,110,0.6)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {toast}
        </div>
      )}

      {/* ── Rename dialog ─────────────────────────────────── */}
      {renaming && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "20px", width: "calc(100% - 48px)", maxWidth: 340, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Rename Sheet</div>
            <input
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenaming(false); }}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setRenaming(false)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmRename} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", color: "#fff", cursor: "pointer" }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SPREADSHEET GRID ════════════════════════════════ */}
      <div
        ref={gridWrap}
        style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" as any, background: C.bg, position: "relative" }}
        onTouchMove={handleGridTouchMove}
        onScroll={handleGridScroll}
      >
        <div
          ref={gridContent}
          style={{ minWidth: ROW_NUM_W + cols.length * cellW, height: ROW_H + visRows * ROW_H, position: "relative" }}
        >

          {/* ─ Column header row ─ */}
          <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 20, background: C.headerRowBg, borderBottom: `2px solid ${C.lineHdr}` }}>
            <div style={{ width: ROW_NUM_W, minWidth: ROW_NUM_W, height: ROW_H, background: C.cornerBg, borderRight: `1px solid ${C.lineRowNum}`, flexShrink: 0 }} />
            {cols.map((col, ci) => {
              const inCol = ns && ci >= ns.minC && ci <= ns.maxC;
              return (
                <div key={col} style={{
                  width: cellW, minWidth: cellW, height: ROW_H,
                  borderRight: `1px solid ${C.lineV}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11.5, fontWeight: 600, letterSpacing: "0.08em",
                  flexShrink: 0, userSelect: "none",
                  background: inCol ? C.selColBg : C.headerRowBg,
                  color: inCol ? C.selColText : C.colHdrText,
                  transition: "background 0.1s",
                }}>
                  {col}
                </div>
              );
            })}
          </div>

          {/* ─ Data rows ─ */}
          <div style={{ position: "absolute", left: 0, right: 0, top: ROW_H + visibleRange.start * ROW_H }}>
          {visibleRows.map((ri) => {
            const inRow = ns && ri >= ns.minR && ri <= ns.maxR;
            return (
              <div key={ri} style={{ display: "flex", borderBottom: `1px solid ${C.lineH}`, background: inRow ? "rgba(130,45,45,0.06)" : C.bg }}>

                {/* Row number */}
                <div style={{
                  width: ROW_NUM_W, minWidth: ROW_NUM_W, height: ROW_H,
                  borderRight: `1px solid ${C.lineRowNum}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 500,
                  color: inRow ? C.selColText : C.rowNumText,
                  background: C.rowNumBg,
                  flexShrink: 0, userSelect: "none",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {ri + 1}
                </div>

                {/* Cells */}
                {cols.map((col, ci) => {
                  const val        = sheet[col]?.[ri] ?? "";
                  const selected   = inSel(ci, ri, ns);
                  // Border edges of selection
                  const isTopEdge  = selected && ri === ns!.minR;
                  const isBotEdge  = selected && ri === ns!.maxR;
                  const isLftEdge  = selected && ci === ns!.minC;
                  const isRgtEdge  = selected && ci === ns!.maxC;
                  return (
                    <div
                      key={col}
                      data-ci={ci}
                      data-ri={ri}
                      onClick={(e) => handleCellTap(ci, ri, e)}
                      onTouchStart={(e) => handleCellLongPressStart(ci, ri, e)}
                      onTouchEnd={handleCellLongPressEnd}
                      onTouchMove={handleCellLongPressEnd}
                      style={{
                        width: cellW, minWidth: cellW, height: ROW_H,
                        borderRight: isRgtEdge ? `1.5px solid ${C.selOutline}` : `1px solid ${C.lineV}`,
                        borderTop:    isTopEdge ? `1.5px solid ${C.selOutline}` : undefined,
                        borderBottom: isBotEdge ? `1.5px solid ${C.selOutline}` : undefined,
                        borderLeft:   isLftEdge ? `1.5px solid ${C.selOutline}` : undefined,
                        display: "flex", alignItems: "center",
                        padding: "0 6px",
                        fontSize: 11.5,
                        color: val ? C.cellText : "transparent",
                        overflow: "hidden",
                        cursor: "default",
                        flexShrink: 0, userSelect: "none",
                        boxSizing: "border-box",
                        background: selected ? C.selFill : "transparent",
                        transition: lightweight ? "none" : "background 0.06s",
                      }}
                      title={val || undefined}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", display: "block", lineHeight: 1 }}>
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>

          {/* ── Drag handles ──────────────────────────────── */}
          {ns && handleTL && (
            <div
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); draggingHandle.current = "tl"; }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); draggingHandle.current = "tl"; }}
              style={{
                position: "absolute",
                left: handleTL.left, top: handleTL.top,
                width: HANDLE_R * 2, height: HANDLE_R * 2,
                borderRadius: "50%",
                background: C.selHandle,
                border: "2.5px solid #fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.55)",
                zIndex: 30, cursor: "pointer",
                touchAction: "none",
              }}
            />
          )}
          {ns && handleBR && (
            <div
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); draggingHandle.current = "br"; }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); draggingHandle.current = "br"; }}
              style={{
                position: "absolute",
                left: handleBR.left, top: handleBR.top,
                width: HANDLE_R * 2, height: HANDLE_R * 2,
                borderRadius: "50%",
                background: C.selHandle,
                border: "2.5px solid #fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.55)",
                zIndex: 30, cursor: "pointer",
                touchAction: "none",
              }}
            />
          )}

        </div>
      </div>

      {/* ══ CELL ACTION MENU ═══════════════════════════════ */}
      {cellMenu && ns && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(cellMenu.y, window.innerHeight - 130),
            left: Math.min(cellMenu.x, window.innerWidth - 145),
            zIndex: 500,
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.65)",
            overflow: "hidden",
            minWidth: 140,
          }}
        >
          {/* Header label */}
          <div style={{ padding: "6px 12px", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {isSingleCell ? `Cell ${fxCellLabel}` : `Range ${fxCellLabel}`}
          </div>
          {/* Copy */}
          <button
            onClick={() => { handleCopy(); setCellMenu(null); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "transparent", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", textAlign: "left" }}
          >
            <Copy size={13} color="#a0b4ff" />
            Copy
          </button>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 10px" }} />
          {/* Cut */}
          <button
            onClick={handleCut}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "transparent", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", textAlign: "left" }}
          >
            <Scissors size={13} color="#ffb0a0" />
            Cut
          </button>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 10px" }} />
          {/* Paste */}
          <button
            onClick={handlePaste}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "transparent", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", textAlign: "left" }}
          >
            <ClipboardPaste size={13} color="#a0ffb4" />
            Paste
          </button>
        </div>
      )}

      {/* ══ FX BAR ══════════════════════════════════════════ */}
      <div style={{ background: C.fxBarBg, borderTop: `1.5px solid ${C.lineHdr}`, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 30 }}>

        {/* fx circle */}
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: ns ? C.selColText : "rgba(255,255,255,0.38)", fontStyle: "italic", fontFamily: "Georgia,serif", transition: "color 0.15s" }}>fx</span>
        </div>

        {/* Pill input */}
        <div style={{ flex: 1, position: "relative" }}>
          {ns && (
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 800, color: C.selColText, fontFamily: "monospace", letterSpacing: "0.06em", pointerEvents: "none", zIndex: 2 }}>
              {fxCellLabel}
            </span>
          )}
          <input
            ref={fxInputRef}
            value={ns && !isSingleCell ? "" : fxValue}
            onChange={(e) => { setFxValue(e.target.value); setFxDirty(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleFxConfirm(); if (e.key === "Escape") handleFxDismiss(); }}
            placeholder={ns && !isSingleCell ? `Range ${fxCellLabel} selected` : "Enter text or formula"}
            readOnly={!!(ns && !isSingleCell)}
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: ns ? "1px solid rgba(160,70,70,0.55)" : "1px solid rgba(255,255,255,0.11)",
              borderRadius: 22,
              padding: ns ? "6px 14px 6px 46px" : "6px 14px",
              color: ns && !isSingleCell ? "rgba(255,255,255,0.4)" : ns ? "#fff" : "rgba(255,255,255,0.32)",
              fontSize: 12.5, outline: "none", fontFamily: "inherit",
              boxSizing: "border-box", transition: "border 0.15s",
            }}
          />
        </div>

        {/* Check button */}
        <button
          onClick={isSingleCell ? handleFxConfirm : undefined}
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: fxDirty && isSingleCell ? "linear-gradient(135deg,#9b1c1c,#dc3545)" : ns ? "rgba(140,55,55,0.28)" : "rgba(255,255,255,0.04)",
            border: fxDirty && isSingleCell ? "none" : ns ? "1px solid rgba(180,70,70,0.4)" : "1px solid rgba(255,255,255,0.09)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: isSingleCell ? "pointer" : "default", flexShrink: 0,
            boxShadow: fxDirty && isSingleCell ? "0 0 14px rgba(180,50,50,0.6)" : "none",
            transition: "all 0.15s",
          }}
        >
          <Check size={14} color={fxDirty && isSingleCell ? "#fff" : ns ? "rgba(255,160,160,0.7)" : "rgba(255,255,255,0.2)"} strokeWidth={2.5} />
        </button>

        {/* Dismiss X */}
        {ns && (
          <button onClick={handleFxDismiss} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={11} color="rgba(255,255,255,0.4)" />
          </button>
        )}
      </div>
    </div>
  );
}
