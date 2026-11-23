import { Link } from "wouter";
import {
  FileSpreadsheet, Code2, MessageCircle, ChevronRight, LayoutGrid, UserPlus,
  Settings, X, Languages,
} from "lucide-react";
import appLogoUrl from "@/assets/app-logo.webp?inline";
import { useEffect, useState } from "react";
import { getPerformanceMode, getTimerDelay } from "@/lib/performanceMode";
import { useLang, t, type Lang } from "@/lib/language";

const MENU_ITEMS = [
  {
    label: "FLOAT SHEET SET-UP",
    description: "Google Sheets সংযোগ সেট আপ করুন",
    icon: FileSpreadsheet,
    href: "/float-sheet-setup",
    glowColor: "#3b82f6",
    tag: "SHEET",
  },
  {
    label: "GOOGLE SHEET APP SCRIPT",
    description: "Apps Script কোড পান ও কপি করুন",
    icon: Code2,
    href: "/app-script",
    glowColor: "#14b8a6",
    tag: "SCRIPT",
  },
  {
    label: "XENOX APP SHEET MODE",
    description: "Internet ছাড়া App-এর ভেতরেই ডেটা সংরক্ষণ করুন",
    icon: LayoutGrid,
    href: "/local-sheet",
    glowColor: "#8b5cf6",
    tag: "XENOX APP SHEET",
  },
  {
    label: "CREATE ACC",
    description: "Instagram ও Facebook অ্যাকাউন্ট তৈরি করুন",
    icon: UserPlus,
    href: "/create-acc",
    glowColor: "#a855f7",
    tag: "ACCOUNT",
  },
  {
    label: "CONTACT SUPPORT",
    description: "Telegram-এ সাপোর্টে যোগাযোগ করুন",
    icon: MessageCircle,
    href: "/contact-support",
    glowColor: "#0ea5e9",
    tag: "TELEGRAM",
  },
];

function pad2(n: number) {
  return n < 10 ? "0" + n : String(n);
}

function nowTimeStr() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function nowDateStr() {
  try {
    return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return new Date().toDateString();
  }
}

export default function Home() {
  const perfMode = getPerformanceMode();
  const lightweight = perfMode.safeMode;
  const [lang, changeLang] = useLang();
  const [showSettings, setShowSettings] = useState(false);
  const [liveTime, setLiveTime] = useState(nowTimeStr());
  const [liveDate, setLiveDate] = useState(nowDateStr());

  useEffect(() => {
    const tick = () => {
      const nt = nowTimeStr();
      const nd = nowDateStr();
      setLiveTime((p) => (p === nt ? p : nt));
      setLiveDate((p) => (p === nd ? p : nd));
    };
    const id = setInterval(tick, getTimerDelay(1000));
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-x-hidden">

      {/* Ambient background glow */}
      {!lightweight && (
        <div className="fixed top-0 left-0 right-0 h-72 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.14) 0%, transparent 70%)" }} />
      )}

      {/* Header */}
      <header
        className="relative z-50 border-b border-white/[0.06]"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: lightweight ? "none" : "blur(20px)",
          marginTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black tracking-tight leading-none">
              <span className="text-white">Xenox</span>
              <span style={{ color: "#60a5fa" }}> Short</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[9px] font-mono font-bold" style={{ color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>
                {liveTime}
              </span>
              <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{liveDate}</span>
            </div>
          </div>

          <button onClick={() => setShowSettings(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl active:opacity-70 flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <Settings className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>
        </div>
      </header>

      <main className="relative flex-1 max-w-md mx-auto w-full px-4 pt-5 pb-10">

        {/* ── Hero ── */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-[20px] overflow-hidden flex items-center justify-center bg-blue-950/40"
              style={{ boxShadow: "0 0 0 1px rgba(59,130,246,0.3), 0 0 28px rgba(59,130,246,0.5), 0 0 56px rgba(59,130,246,0.2)" }}>
              <img src={appLogoUrl} alt="Xenox Short" className="w-full h-full object-contain" />
            </div>
            {!lightweight && (
              <div className="absolute inset-0 rounded-[20px]"
                style={{ border: "2px solid rgba(59,130,246,0.5)", animation: "xenox-ping 2.5s ease-out infinite" }} />
            )}
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.28)", color: "#4ade80", boxShadow: lightweight ? "none" : "0 0 16px rgba(34,197,94,0.12)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80", boxShadow: lightweight ? "none" : "0 0 6px #4ade80", animation: lightweight ? "none" : "xenox-pulse 2s infinite" }} />
            Service: ACTIVE
          </div>
        </div>

        {/* ── Menu Cards ── */}
        <div className="space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className="relative w-full rounded-xl cursor-pointer overflow-hidden active:opacity-70"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: item.glowColor }} />
                  <div className="flex items-center gap-3 px-4 py-3.5 pl-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <Icon className="w-5 h-5" style={{ color: item.glowColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[12px] text-white tracking-wide leading-snug">{item.label}</p>
                        <span className="text-[9px] font-bold px-1.5 py-[2px] rounded tracking-widest"
                          style={{ background: `${item.glowColor}18`, color: item.glowColor, border: `1px solid ${item.glowColor}30` }}>
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.38)" }}>{item.description}</p>
                    </div>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: item.glowColor }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {!lightweight && <footer className="relative py-5 text-center border-t border-white/[0.05]">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-[4px] overflow-hidden">
            <img src={appLogoUrl} alt="Xenox Short" className="w-full h-full object-cover" />
          </div>
          <p className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.18)" }}>
            XENOX SHORT &mdash; v1.0
          </p>
        </div>
      </footer>}

      {/* ── Settings Bottom Sheet (language only) ── */}
      {showSettings && (
        <div className="fixed inset-0 z-[99990] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="w-full max-w-md rounded-t-3xl pb-8"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: "#60a5fa" }} />
                <span className="text-sm font-black text-white">{t("settings.title", lang)}</span>
              </div>
              <button onClick={() => setShowSettings(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
              </button>
            </div>

            <div className="px-4 space-y-2">
              <div className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.12)" }}>
                  <Languages className="w-4 h-4" style={{ color: "#a78bfa" }} />
                </div>
                <span className="flex-1 text-sm font-bold text-white">{t("settings.language", lang)}</span>
                <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                  {(["bn", "en"] as Lang[]).map(l => (
                    <button key={l} onClick={() => changeLang(l)}
                      className="px-3 py-1.5 text-xs font-black transition-all"
                      style={{
                        background: lang === l ? "linear-gradient(135deg, #1d4ed8, #7c3aed)" : "rgba(255,255,255,0.04)",
                        color: lang === l ? "#fff" : "rgba(255,255,255,0.4)",
                      }}>
                      {l === "bn" ? "বাং" : "EN"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes xenox-ping {
          0%   { transform:scale(1);    opacity:0.7; }
          70%  { transform:scale(1.22); opacity:0;   }
          100% { transform:scale(1.22); opacity:0;   }
        }
        @keyframes xenox-pulse {
          0%,100% { opacity:1;   }
          50%     { opacity:0.4; }
        }
      `}</style>
    </div>
  );
}
