import { Link } from "wouter";
import { ArrowLeft, FileSpreadsheet, Save, Play, Square, CheckCircle, AlertCircle, Link2, Grid3X3, Layers, Settings, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getPerformanceMode } from "@/lib/performanceMode";
import { useLang, t } from "@/lib/language";
import launcherIconUrl from "@/assets/launcher-icon.webp?inline";

const OVERLAY_GRANTED_KEY = "xenox_overlay_granted";

const STORAGE_KEY = "xenox_float_config";

declare global {
  interface Window {
    XenoxAndroid?: {
      hasOverlayPermission: () => boolean;
      requestOverlayPermission: () => void;
      startBubble: () => boolean;
      stopBubble: () => void;
      isBubbleRunning: () => boolean;
      showNativeNotification: (title: string, message: string) => void;
      saveConfig: (json: string) => void;
      loadConfig: () => string;
      openAutostartSettings: () => boolean;
      isAccessibilityEnabled?: () => boolean;
      openAccessibilitySettings?: () => void;
      setPremiumStatus?: (active: boolean) => void;
    };
  }
}

const AUTOSTART_ENABLED_KEY = "xenox_autostart_enabled";

// Google Sheet URL থেকে Sheet ID বের করার function
function extractSheetId(input: string): string {
  const trimmed = input.trim();
  // Full URL হলে /d/ এর পরের অংশ নেওয়া
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // আগে থেকেই Sheet ID হলে সেটাই return
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return "";
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    saveMode: "google-sheet",
    sheetLinkOrId: "",
    sheetName: "Sheet1",
    webAppUrl: "",
    columns: "A,B,C",
    buttonSize: 52,
    launcherSize: 62,
    autoUsername: false,
    autoUsernameConfirmed: false,
    autoUsernameColumn: "",
    autoPassword: false,
    autoPasswordValue: "",
    autoPasswordColumn: "",
  };
}

function saveConfig(cfg: object) {
  const next: any = { ...cfg };
  if (typeof next.columns === "string") {
    next.columns = next.columns.split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean).slice(0, 8).join(",");
  }
  next.buttonSize = Math.max(32, Math.min(80, Number(next.buttonSize || 52)));
  next.launcherSize = Math.max(40, Math.min(90, Number(next.launcherSize || 62)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("xenox:bubble-updated"));
}

export default function FloatSheetSetup() {
  const { toast } = useToast();
  const [lang] = useLang();
  const lightweight = getPerformanceMode().safeMode;
  const [config, setConfig] = useState(loadConfig);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [showOverlayDialog, setShowOverlayDialog] = useState(false);

  // ── Auto Username state ──
  const [unameStep, setUnameStep] = useState<"idle" | "confirm" | "column">("idle");
  const [unameColInput, setUnameColInput] = useState("");

  // ── Auto Password state ──
  const [passStep, setPassStep] = useState<"idle" | "password" | "column">("idle");
  const [passInput, setPassInput] = useState("");
  const [passColInput, setPassColInput] = useState("");

  // ── AutoStart state ──
  const [autostartDone, setAutostartDone] = useState(
    () => localStorage.getItem(AUTOSTART_ENABLED_KEY) === "true"
  );

  // ── Accessibility state ── (mirrors AutoStart: hide once granted, keep
  // showing if not granted yet, never auto-disable anything)
  const [accessibilityOn, setAccessibilityOn] = useState(
    () => window.XenoxAndroid?.isAccessibilityEnabled?.() ?? false
  );

  useEffect(() => {
    if (!window.XenoxAndroid?.isAccessibilityEnabled) return;
    const recheck = () => setAccessibilityOn(!!window.XenoxAndroid?.isAccessibilityEnabled?.());
    recheck();
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setConfig(JSON.parse(raw)); } catch {}
    }
    // Sync running state from localStorage (persists across navigation)
    const isAlreadyRunning = localStorage.getItem("xenox_bubble_running") === "true";
    setRunning(isAlreadyRunning);
  }, []);

  const update = (key: string, value: string | number) =>
    setConfig((prev: typeof config) => ({ ...prev, [key]: value }));

  const isGoogleMode = config.saveMode === "google-sheet";

  // Extract করা Sheet ID
  const extractedId = extractSheetId(config.sheetLinkOrId || "");
  const isValidSheetInput = extractedId.length >= 20;
  const isPastedUrl = (config.sheetLinkOrId || "").includes("docs.google.com");

  const handleSave = () => {
    if (isGoogleMode) {
      if (!config.sheetLinkOrId?.trim()) {
        toast({ title: t("float.err_sheet_id", lang), variant: "destructive" });
        return;
      }
      if (!isValidSheetInput) {
        toast({ title: t("float.err_sheet_invalid", lang), variant: "destructive" });
        return;
      }
      if (!config.webAppUrl?.trim()) {
        toast({ title: t("float.err_webapp", lang), variant: "destructive" });
        return;
      }
      if (!config.webAppUrl.includes("script.google.com")) {
        toast({ title: t("float.err_webapp_invalid", lang), variant: "destructive" });
        return;
      }
    }
    if (!config.columns?.trim()) {
      toast({ title: t("float.err_columns", lang), variant: "destructive" });
      return;
    }
    const finalConfig = { ...config, extractedSheetId: extractedId };
    saveConfig(finalConfig);
    // ── Critical: sync to Android SharedPreferences so BubbleService picks it up ──
    if (window.XenoxAndroid?.saveConfig) {
      try {
        window.XenoxAndroid.saveConfig(JSON.stringify(finalConfig));
      } catch {}
    }
    setSaved(true);
    toast({ title: t("float.toast_saved", lang), description: t("float.toast_saved_desc", lang) });
    setTimeout(() => setSaved(false), 2500);
  };

  const handleStart = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      toast({ title: t("float.save_first", lang), description: t("float.save_first_desc", lang), variant: "destructive" });
      return;
    }
    if (window.XenoxAndroid) {
      if (!window.XenoxAndroid.hasOverlayPermission()) {
        window.XenoxAndroid.requestOverlayPermission();
        toast({ title: t("float.overlay_title", lang), description: t("float.overlay_desc", lang) });
        return;
      }
      const started = window.XenoxAndroid.startBubble();
      if (!started) {
        toast({ title: t("float.bubble_fail", lang), description: t("float.bubble_fail_desc", lang), variant: "destructive" });
        return;
      }
      doStartBubble();
      return;
    }
    // If user hasn't seen the overlay dialog yet, show it first
    const overlayGranted = localStorage.getItem(OVERLAY_GRANTED_KEY);
    if (!overlayGranted) {
      setShowOverlayDialog(true);
      return;
    }
    doStartBubble();
  };

  const doStartBubble = () => {
    localStorage.setItem("xenox_bubble_running", "true");
    window.dispatchEvent(new Event("xenox:bubble-updated"));
    setRunning(true);
    toast({ title: t("float.bubble_started", lang), description: t("float.bubble_started_desc", lang) });
  };

  const handleStop = () => {
    if (window.XenoxAndroid) {
      window.XenoxAndroid.stopBubble();
    }
    localStorage.setItem("xenox_bubble_running", "false");
    window.dispatchEvent(new Event("xenox:bubble-updated"));
    setRunning(false);
    toast({ title: t("float.bubble_stopped", lang) });
  };

  const isOn = (v: any) => v === true || v === "true";

  const baseInput = `w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none transition-all`;

  const sectionStyle = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    outline: "none",
  };

  const stepBadge = (n: string) => (
    <div
      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.3)" }}
    >
      <span className="text-[10px] font-black" style={{ color: "#60a5fa" }}>{n}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Top glow */}
      <div
        className="fixed top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <header
        className="relative z-50 border-b border-white/[0.06] sticky top-0"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)" }}
      >
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center gap-3">
          <Link href="/">
            <button
              data-testid="button-back"
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <ArrowLeft className="w-4 h-4 text-white/60" />
            </button>
          </Link>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #3b82f6)" }}
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none">Float Sheet Set-Up</h1>
            <p className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Google Sheet Configuration
            </p>
          </div>
          {running && (
            <div
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: "xs-pulse 2s infinite" }} />
              LIVE
            </div>
          )}
        </div>
      </header>

      <main className="relative flex-1 max-w-md mx-auto w-full px-4 pt-5 pb-10 space-y-4">

        {/* ── SAVE MODE TOGGLE ── */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{
            background: isGoogleMode
              ? "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(29,78,216,0.06))"
              : "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(109,40,217,0.06))",
            border: isGoogleMode ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(139,92,246,0.3)",
            transition: "all 0.3s ease",
          }}
        >
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Save Mode</p>
            <p className="text-sm font-black" style={{ color: isGoogleMode ? "#60a5fa" : "#a78bfa" }}>
              {isGoogleMode ? "Google Sheet Mode" : "Xenox App Sheet Mode"}
            </p>
          </div>
          <button
            data-testid="toggle-save-mode"
            onClick={() => update("saveMode", isGoogleMode ? "local" : "google-sheet")}
            className="relative flex-shrink-0"
            style={{
              width: "52px", height: "28px", borderRadius: "14px",
              background: isGoogleMode ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "rgba(255,255,255,0.08)",
              border: isGoogleMode ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.15)",
              transition: "all 0.3s ease",
              boxShadow: isGoogleMode ? "0 0 14px rgba(59,130,246,0.35)" : "none",
            }}
          >
            <span style={{
              position: "absolute", top: "3px",
              left: isGoogleMode ? "27px" : "3px",
              width: "20px", height: "20px", borderRadius: "50%",
              background: "#fff", transition: "left 0.25s ease",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }} />
          </button>
        </div>

        {/* ── GOOGLE SHEET SETTINGS ── */}
        {isGoogleMode && (
          <div className="rounded-2xl p-4 space-y-4" style={sectionStyle}>
            <div className="flex items-center gap-2">
              {stepBadge("1")}
              <p className="text-xs font-bold text-white">Google Sheet Settings</p>
            </div>

            {/* Sheet Link or ID */}
            <div>
              <label className="text-[11px] text-white/40 mb-2 block tracking-wide flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                Google Sheet Link অথবা Sheet ID
              </label>
              <input
                data-testid="input-sheet-link-or-id"
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/... অথবা শুধু Sheet ID"
                value={config.sheetLinkOrId || ""}
                onChange={(e) => update("sheetLinkOrId", e.target.value)}
                className={baseInput}
                style={{
                  ...inputStyle,
                  border: config.sheetLinkOrId
                    ? isValidSheetInput
                      ? "1px solid rgba(34,197,94,0.4)"
                      : "1px solid rgba(239,68,68,0.35)"
                    : "1px solid rgba(255,255,255,0.1)",
                }}
              />

              {/* Auto-extracted Sheet ID display */}
              {config.sheetLinkOrId && (
                <div className="mt-2 rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={{
                    background: isValidSheetInput ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                    border: isValidSheetInput ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {isValidSheetInput ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                      <div>
                        <p className="text-[10px] font-bold" style={{ color: "#4ade80" }}>
                          {isPastedUrl ? "✓ URL থেকে Sheet ID বের হয়েছে" : "✓ Sheet ID পাওয়া গেছে"}
                        </p>
                        <p className="text-[11px] mt-0.5 font-mono break-all" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {extractedId}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                      <p className="text-[10px]" style={{ color: "#f87171" }}>
                        সঠিক Google Sheet URL বা Sheet ID দিন
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sheet Name */}
            <div>
              <label className="text-[11px] text-white/40 mb-2 block tracking-wide">
                Sheet Name (ট্যাবের নাম)
              </label>
              <input
                data-testid="input-sheet-name"
                type="text"
                placeholder="Sheet1"
                value={config.sheetName || ""}
                onChange={(e) => update("sheetName", e.target.value)}
                className={baseInput}
                style={inputStyle}
              />
              <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                Google Sheet-এর নিচে যে ট্যাব নাম আছে (default: Sheet1)
              </p>
            </div>

            {/* Web App URL */}
            <div>
              <label className="text-[11px] text-white/40 mb-2 block tracking-wide">
                Web App URL
              </label>
              <input
                data-testid="input-web-app-url"
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={config.webAppUrl || ""}
                onChange={(e) => update("webAppUrl", e.target.value)}
                className={baseInput}
                style={{
                  ...inputStyle,
                  border: config.webAppUrl
                    ? config.webAppUrl.includes("script.google.com")
                      ? "1px solid rgba(34,197,94,0.4)"
                      : "1px solid rgba(239,68,68,0.35)"
                    : "1px solid rgba(255,255,255,0.1)",
                }}
              />
              {config.webAppUrl && config.webAppUrl.includes("script.google.com") && (
                <div className="mt-2 flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" style={{ color: "#4ade80" }} />
                  <p className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>✓ {t("float.web_app_url", lang)}</p>
                </div>
              )}
              <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                {t("float.url_hint", lang)}
              </p>
            </div>
          </div>
        )}

        {/* ── COLUMN BUTTONS ── */}
        <div className="rounded-2xl p-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-3">
            {stepBadge(isGoogleMode ? "2" : "1")}
            <p className="text-xs font-bold text-white">Column Buttons</p>
            <span className="text-[10px] ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>Comma Separated</span>
          </div>
          <input
            data-testid="input-columns"
            type="text"
            placeholder="A,B,C"
            value={config.columns || ""}
            onChange={(e) => update("columns", e.target.value)}
            className={baseInput}
            style={inputStyle}
          />
          <p className="text-[10px] mt-1.5 mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
            {t("float.col_hint", lang)}
          </p>

          {/* Column chip preview */}
          {(config.columns || "").trim() && (
            <div className="flex flex-wrap gap-2">
              {(config.columns || "").split(",").map((col: string, i: number) => col.trim() && (
                <div
                  key={i}
                  className="flex flex-col items-center px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.28)",
                    minWidth: "44px",
                  }}
                >
                  <span className="text-xs font-black" style={{ color: "#60a5fa" }}>
                    {col.trim().toUpperCase()}
                  </span>
                  <span className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>col</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── AUTO GENERATE USERNAME ── */}
        <div className="rounded-2xl p-4 space-y-3" style={sectionStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {stepBadge(isGoogleMode ? "3" : "2")}
              <div>
                <p className="text-xs font-bold text-white">Auto Generate Username</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>♻ bubble দিয়ে random username তৈরি করুন</p>
              </div>
            </div>
            <button
              data-testid="toggle-auto-username"
              onClick={() => {
                const next = !isOn(config.autoUsername);
                update("autoUsername", next ? "true" : "false");
                if (next) {
                  setUnameStep("confirm");
                } else {
                  setUnameStep("idle");
                  update("autoUsernameConfirmed", "false");
                  update("autoUsernameColumn", "");
                }
              }}
              className="relative flex-shrink-0"
              style={{
                width: "52px", height: "28px", borderRadius: "14px",
                background: isOn(config.autoUsername) ? "linear-gradient(135deg, #f59e0b, #d97706)" : "rgba(255,255,255,0.08)",
                border: isOn(config.autoUsername) ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.15)",
                transition: "all 0.3s ease",
                boxShadow: isOn(config.autoUsername) ? "0 0 14px rgba(245,158,11,0.35)" : "none",
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: isOn(config.autoUsername) ? "27px" : "3px",
                width: "20px", height: "20px", borderRadius: "50%",
                background: "#fff", transition: "left 0.25s ease",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }} />
            </button>
          </div>

          {/* Step: confirm */}
          {isOn(config.autoUsername) && unameStep === "confirm" && (
            <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-xs font-bold text-white">Do you auto username paste?</p>
              <div className="flex gap-2">
                <button
                  data-testid="button-uname-yes"
                  onClick={() => { setUnameStep("column"); }}
                  className="flex-1 py-2 rounded-xl text-xs font-black text-white"
                  style={{ background: "linear-gradient(135deg,#15803d,#16a34a)", border: "1px solid rgba(34,197,94,0.4)" }}
                >Yes</button>
                <button
                  data-testid="button-uname-no"
                  onClick={() => {
                    update("autoUsername", "false");
                    update("autoUsernameConfirmed", "false");
                    setUnameStep("idle");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
                >No</button>
              </div>
            </div>
          )}

          {/* Step: enter column */}
          {isOn(config.autoUsername) && unameStep === "column" && (
            <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-xs font-bold text-white">Enter your Column</p>
              <input
                data-testid="input-uname-column"
                type="text"
                maxLength={2}
                placeholder="A"
                value={unameColInput}
                onChange={(e) => setUnameColInput(e.target.value.toUpperCase())}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.3)" }}
              />
              <button
                data-testid="button-uname-done"
                onClick={() => {
                  const col = unameColInput.trim().toUpperCase();
                  if (!col) { toast({ title: "Column লিখুন (যেমন A, B, C)", variant: "destructive" }); return; }
                  update("autoUsernameConfirmed", "true");
                  update("autoUsernameColumn", col);
                  // Persist immediately so bubble reads correct column even without clicking Save
                  saveConfig({ ...config, autoUsernameConfirmed: "true", autoUsernameColumn: col });
                  setUnameStep("idle");
                  toast({ title: "✅ Auto Username সেট হয়েছে", description: `Column: ${col}` });
                }}
                className="w-full py-2.5 rounded-xl text-xs font-black text-white"
                style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)", border: "1px solid rgba(245,158,11,0.4)" }}
              >Done ✓</button>
            </div>
          )}

          {/* Saved state */}
          {isOn(config.autoUsername) && isOn(config.autoUsernameConfirmed) && unameStep === "idle" && config.autoUsernameColumn && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span style={{ fontSize: 16 }}>♻</span>
              <div>
                <p className="text-[11px] font-bold" style={{ color: "#fbbf24" }}>Username Column: {config.autoUsernameColumn}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Bubble-এ ♻ দেখাবে</p>
              </div>
              <button
                onClick={() => setUnameStep("column")}
                className="ml-auto text-[10px] px-2 py-1 rounded-lg"
                style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}
              >Edit</button>
            </div>
          )}
        </div>

        {/* ── AUTO PASTE PASSWORD ── */}
        <div className="rounded-2xl p-4 space-y-3" style={sectionStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {stepBadge(isGoogleMode ? "4" : "3")}
              <div>
                <p className="text-xs font-bold text-white">Auto Paste Password</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>🗝︎ bubble দিয়ে password auto paste করুন</p>
              </div>
            </div>
            <button
              data-testid="toggle-auto-password"
              onClick={() => {
                const next = !isOn(config.autoPassword);
                update("autoPassword", next ? "true" : "false");
                if (next) {
                  setPassStep("password");
                  setPassInput(config.autoPasswordValue || "");
                  setPassColInput(config.autoPasswordColumn || "");
                } else {
                  setPassStep("idle");
                  update("autoPasswordValue", "");
                  update("autoPasswordColumn", "");
                }
              }}
              className="relative flex-shrink-0"
              style={{
                width: "52px", height: "28px", borderRadius: "14px",
                background: isOn(config.autoPassword) ? "linear-gradient(135deg, #7c3aed, #8b5cf6)" : "rgba(255,255,255,0.08)",
                border: isOn(config.autoPassword) ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.15)",
                transition: "all 0.3s ease",
                boxShadow: isOn(config.autoPassword) ? "0 0 14px rgba(139,92,246,0.35)" : "none",
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: isOn(config.autoPassword) ? "27px" : "3px",
                width: "20px", height: "20px", borderRadius: "50%",
                background: "#fff", transition: "left 0.25s ease",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }} />
            </button>
          </div>

          {/* Step 1: enter password */}
          {isOn(config.autoPassword) && passStep === "password" && (
            <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <p className="text-xs font-bold text-white">Enter your password</p>
              <input
                data-testid="input-auto-password"
                type="text"
                placeholder="password লিখুন"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.3)" }}
              />
              <button
                data-testid="button-pass-done"
                onClick={() => {
                  if (!passInput.trim()) { toast({ title: "Password লিখুন", variant: "destructive" }); return; }
                  update("autoPasswordValue", passInput.trim());
                  setPassStep("column");
                }}
                className="w-full py-2.5 rounded-xl text-xs font-black text-white"
                style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", border: "1px solid rgba(139,92,246,0.4)" }}
              >Done ✓</button>
            </div>
          )}

          {/* Step 2: enter column */}
          {isOn(config.autoPassword) && passStep === "column" && (
            <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <p className="text-xs font-bold text-white">Enter your Column</p>
              <input
                data-testid="input-pass-column"
                type="text"
                maxLength={2}
                placeholder="B"
                value={passColInput}
                onChange={(e) => setPassColInput(e.target.value.toUpperCase())}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.3)" }}
              />
              <button
                data-testid="button-pass-col-done"
                onClick={() => {
                  const col = passColInput.trim().toUpperCase();
                  if (!col) { toast({ title: "Column লিখুন (যেমন A, B, C)", variant: "destructive" }); return; }
                  update("autoPasswordColumn", col);
                  // Persist immediately so bubble reads correct column even without clicking Save
                  saveConfig({ ...config, autoPasswordColumn: col, autoPasswordValue: passInput.trim() || config.autoPasswordValue });
                  setPassStep("idle");
                  toast({ title: "✅ Auto Password সেট হয়েছে", description: `Column: ${col}` });
                }}
                className="w-full py-2.5 rounded-xl text-xs font-black text-white"
                style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", border: "1px solid rgba(139,92,246,0.4)" }}
              >Done ✓</button>
            </div>
          )}

          {/* Saved state */}
          {isOn(config.autoPassword) && config.autoPasswordValue && config.autoPasswordColumn && passStep === "idle" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <span style={{ fontSize: 16 }}>🗝︎</span>
              <div>
                <p className="text-[11px] font-bold" style={{ color: "#a78bfa" }}>Password Column: {config.autoPasswordColumn}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Bubble-এ 🗝︎ দেখাবে</p>
              </div>
              <button
                onClick={() => { setPassInput(config.autoPasswordValue || ""); setPassColInput(config.autoPasswordColumn || ""); setPassStep("password"); }}
                className="ml-auto text-[10px] px-2 py-1 rounded-lg"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
              >Edit</button>
            </div>
          )}
        </div>

        {/* ── ENABLE AUTOSTART ── */}
        {!autostartDone && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div>
                  <p className="text-xs font-bold text-white">Enable AutoStart (auto-paste)</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Auto-paste ঠিকঠাক কাজ করতে চালু করুন</p>
                </div>
              </div>
              <button
                data-testid="toggle-autostart"
                onClick={() => {
                  if (window.XenoxAndroid?.openAutostartSettings) {
                    window.XenoxAndroid.openAutostartSettings();
                  }
                  localStorage.setItem(AUTOSTART_ENABLED_KEY, "true");
                  setAutostartDone(true);
                }}
                className="relative flex-shrink-0"
                style={{
                  width: "52px", height: "28px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  transition: "all 0.3s ease",
                }}
              >
                <span style={{
                  position: "absolute", top: "3px", left: "3px",
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "#fff", transition: "left 0.25s ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }} />
              </button>
            </div>
          </div>
        )}

        {/* ── ACCESSIBILITY ── */}
        {!accessibilityOn && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div>
                  <p className="text-xs font-bold text-white">Accessibility</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Auto-paste ঠিকঠাক কাজ করতে চালু করুন</p>
                </div>
              </div>
              <button
                data-testid="toggle-accessibility"
                onClick={() => {
                  window.XenoxAndroid?.openAccessibilitySettings?.();
                }}
                className="relative flex-shrink-0"
                style={{
                  width: "52px", height: "28px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  transition: "all 0.3s ease",
                }}
              >
                <span style={{
                  position: "absolute", top: "3px", left: "3px",
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "#fff", transition: "left 0.25s ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }} />
              </button>
            </div>
          </div>
        )}

        {/* ── BUTTON SIZE ── */}
        <div className="rounded-2xl p-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4">
            {stepBadge(isGoogleMode ? "3" : "2")}
            <p className="text-xs font-bold text-white">Button Size</p>
            <span className="text-[10px] ml-auto" style={{ color: "rgba(255,255,255,0.3)" }}>Drag to Change</span>
            <span
              className="text-xs font-black px-2 py-0.5 rounded-lg"
              style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              {config.buttonSize}px
            </span>
          </div>

          <div className="relative h-2">
            <div className="w-full h-2 rounded-full absolute" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div
              className="h-2 rounded-full absolute"
              style={{
                width: `${((config.buttonSize - 32) / (80 - 32)) * 100}%`,
                background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
                transition: "width 0.1s",
              }}
            />
            <input
              data-testid="slider-button-size"
              type="range" min={32} max={80}
              value={config.buttonSize}
              onChange={(e) => update("buttonSize", Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-blue-400 bg-white"
              style={{
                left: `calc(${((config.buttonSize - 32) / (80 - 32)) * 100}% - 10px)`,
                boxShadow: "0 0 10px rgba(59,130,246,0.5)",
                pointerEvents: "none",
                transition: "left 0.1s",
              }}
            />
          </div>

          {/* Live preview */}
          <div className="mt-5 flex items-end justify-center gap-3">
            {((config.columns || "A,B,C").split(",").slice(0, 3)).map((col: string, i: number) => (
              <div
                key={i}
                className="rounded-2xl flex flex-col items-center justify-center transition-all flex-shrink-0"
                style={{
                  width: `${config.buttonSize}px`,
                  height: `${config.buttonSize}px`,
                  background: i === 0
                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                    : i === 1
                    ? "linear-gradient(135deg, #16a34a, #22c55e)"
                    : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                  boxShadow: i === 0
                    ? "0 0 16px rgba(239,68,68,0.4)"
                    : i === 1
                    ? "0 0 16px rgba(34,197,94,0.4)"
                    : "0 0 16px rgba(59,130,246,0.4)",
                  fontSize: `${Math.round(config.buttonSize * 0.28)}px`,
                  fontWeight: "900",
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                <span>{col.trim().toUpperCase() || "A"}</span>
                <span style={{ fontSize: `${Math.round(config.buttonSize * 0.16)}px`, opacity: 0.7, marginTop: "2px" }}>
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Preview — Floating button এ এরকম দেখাবে
          </p>
        </div>

        {/* ── LAUNCHER BUBBLE SIZE ── */}
        <div className="rounded-2xl p-4" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4">
            {stepBadge(isGoogleMode ? "4" : "3")}
            <p className="text-xs font-bold text-white">Launcher Bubble Size</p>
            <span className="text-[10px] ml-auto" style={{ color: "rgba(255,255,255,0.3)" }}>Main Icon</span>
            <span
              className="text-xs font-black px-2 py-0.5 rounded-lg"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
            >
              {config.launcherSize ?? 62}px
            </span>
          </div>

          <div className="relative h-2">
            <div className="w-full h-2 rounded-full absolute" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div
              className="h-2 rounded-full absolute"
              style={{
                width: `${(((config.launcherSize ?? 62) - 40) / (90 - 40)) * 100}%`,
                background: "linear-gradient(90deg, #7c3aed, #8b5cf6)",
                transition: "width 0.1s",
              }}
            />
            <input
              type="range" min={40} max={90}
              value={config.launcherSize ?? 62}
              onChange={(e) => update("launcherSize", Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 bg-white"
              style={{
                borderColor: "#8b5cf6",
                left: `calc(${(((config.launcherSize ?? 62) - 40) / (90 - 40)) * 100}% - 10px)`,
                boxShadow: "0 0 10px rgba(139,92,246,0.5)",
                pointerEvents: "none",
                transition: "left 0.1s",
              }}
            />
          </div>

          {/* Live preview — launcher icon only */}
          <div className="mt-5 flex items-center justify-center">
            <div
              className="rounded-full overflow-hidden flex-shrink-0"
              style={{
                width: `${config.launcherSize ?? 62}px`,
                height: `${config.launcherSize ?? 62}px`,
                background: "#0a0a0a",
                boxShadow: lightweight ? "none" : "0 0 22px rgba(139,92,246,.75),0 0 44px rgba(139,92,246,.35)",
                border: "2px solid rgba(139,92,246,.55)",
                position: "relative",
              }}
            >
              <img
                src={launcherIconUrl}
                alt="launcher preview"
                style={{ position: "absolute", top: "50%", left: "50%", width: "130%", height: "130%", transform: "translate(-50%,-50%)", objectFit: "cover", objectPosition: "52% 48%", borderRadius: "50%", filter: "contrast(1.55) brightness(1.2) saturate(1.6)" }}
              />
            </div>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            {t("float.preview_label", lang)}
          </p>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="space-y-3 pt-1">
          <button
            data-testid="button-save-configure"
            onClick={handleSave}
            className="w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 tracking-wide transition-all"
            style={{
              background: saved ? "linear-gradient(135deg, #16a34a, #22c55e)" : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
              color: "#fff",
              boxShadow: saved ? "0 0 24px rgba(34,197,94,0.35), 0 4px 12px rgba(0,0,0,0.3)" : "0 0 24px rgba(59,130,246,0.35), 0 4px 12px rgba(0,0,0,0.3)",
              border: saved ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(59,130,246,0.4)",
            }}
          >
            <Save className="w-4 h-4" />
            {saved ? "✅ SAVED!" : "SAVE & CONFIGURE"}
          </button>

          <button
            data-testid="button-start-bubble"
            onClick={handleStart}
            disabled={running}
            className="w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 tracking-wide transition-all"
            style={{
              background: running ? "rgba(34,197,94,0.1)" : "linear-gradient(135deg, #15803d, #16a34a)",
              color: running ? "#4ade80" : "#fff",
              boxShadow: running ? "none" : "0 0 20px rgba(22,163,74,0.3), 0 4px 12px rgba(0,0,0,0.3)",
              border: running ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(22,163,74,0.4)",
              opacity: running ? 0.7 : 1,
            }}
          >
            <Play className="w-4 h-4" fill={running ? "#4ade80" : "white"} />
            {running ? "BUBBLE RUNNING..." : "START FLOATING BUBBLE"}
          </button>

          <button
            data-testid="button-stop-service"
            onClick={handleStop}
            disabled={!running}
            className="w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 tracking-wide transition-all"
            style={{
              background: !running ? "rgba(239,68,68,0.05)" : "linear-gradient(135deg, #b91c1c, #dc2626)",
              color: !running ? "rgba(239,68,68,0.3)" : "#fff",
              boxShadow: !running ? "none" : "0 0 20px rgba(220,38,38,0.3), 0 4px 12px rgba(0,0,0,0.3)",
              border: !running ? "1px solid rgba(239,68,68,0.12)" : "1px solid rgba(220,38,38,0.4)",
            }}
          >
            <Square className="w-4 h-4" fill={!running ? "rgba(239,68,68,0.3)" : "white"} />
            STOP SERVICE
          </button>

          {/* Open Local Sheet — shown always, highlighted in local mode */}
          <Link href="/local-sheet">
            <button
              className="w-full py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 tracking-wide transition-all"
              style={{
                background: !isGoogleMode
                  ? "linear-gradient(135deg, rgba(21,128,61,0.3), rgba(34,197,94,0.15))"
                  : "rgba(255,255,255,0.03)",
                color: !isGoogleMode ? "#4ade80" : "rgba(255,255,255,0.3)",
                border: !isGoogleMode ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: !isGoogleMode ? "0 0 16px rgba(34,197,94,0.15)" : "none",
              }}
            >
              <Grid3X3 className="w-4 h-4" />
              OPEN LOCAL SHEET VIEWER
            </button>
          </Link>
        </div>
      </main>

      <style>{`
        @keyframes xs-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* ── "Display over other apps" Permission Dialog ── */}
      {showOverlayDialog && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center pb-8 px-4"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: lightweight ? "none" : "blur(8px)" }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6"
            style={{ background: "linear-gradient(145deg,#0d1117,#131920)", border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 0 60px rgba(139,92,246,0.2), 0 24px 48px rgba(0,0,0,0.7)" }}
          >
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", boxShadow: "0 0 24px rgba(139,92,246,0.5)" }}>
              <Layers className="w-7 h-7 text-white" />
            </div>

            <h2 className="text-base font-black text-white text-center mb-1">
              Overlay Permission দিন
            </h2>
            <p className="text-xs text-center mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Floating Bubble চালু রাখতে এই permission দরকার
            </p>

            {/* Steps */}
            <div className="space-y-2.5 mb-5">
              {[
                { n: "১", text: "Settings খুলুন" },
                { n: "২", text: "Apps & Notifications → বিশেষ App অনুমতি" },
                { n: "৩", text: '"Other apps এর উপর প্রদর্শন করুন" বেছে নিন' },
                { n: "৪", text: "এই App খুঁজে Allow করুন" },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-black"
                    style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
                  >{s.n}</span>
                  <p className="text-xs pt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{s.text}</p>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowOverlayDialog(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                বাতিল
              </button>
              <button
                onClick={() => {
                  if (window.XenoxAndroid) {
                    window.XenoxAndroid.requestOverlayPermission();
                    return;
                  }
                  localStorage.setItem(OVERLAY_GRANTED_KEY, "1");
                  setShowOverlayDialog(false);
                  doStartBubble();
                }}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}
              >
                <Settings className="w-4 h-4" />
                Allow করেছি
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
