import { Link, useLocation } from "wouter";
import { ArrowLeft, Code2, Copy, ChevronDown, ChevronUp, Zap, Info, FileCode } from "lucide-react";
import { useState } from "react";
import { useLang, t } from "@/lib/language";

export default function AppScript() {
  const [lang] = useLang();
  const [showSteps, setShowSteps] = useState(true);
  const [showActions, setShowActions] = useState(false);

  const SETUP_STEPS = [
    { step: "১", title: "Google Sheet খুলুন", desc: lang === "en" ? "Open your Spreadsheet in Google Drive or create a new one." : "Google Drive-এ আপনার Spreadsheet খুলুন অথবা নতুন একটি তৈরি করুন।", color: "#3b82f6" },
    { step: "২", title: "Apps Script Editor খুলুন", desc: lang === "en" ? "Click Extensions → Apps Script from the top menu. The Editor will open in a new window." : "উপরের মেনু থেকে Extensions → Apps Script-এ ক্লিক করুন। নতুন উইন্ডোতে Editor খুলবে।", color: "#14b8a6" },
    { step: "৩", title: lang === "en" ? "Delete old code & paste" : "পুরনো কোড মুছুন ও পেস্ট করুন", desc: lang === "en" ? "Delete everything in the Editor (Ctrl+A → Delete), then copy and paste the code below." : "Editor-এ যা আছে সব মুছে ফেলুন (Ctrl+A → Delete), তারপর নিচের কোডটি কপি করে পেস্ট করুন।", color: "#8b5cf6" },
    { step: "৪", title: "Save করুন", desc: lang === "en" ? "Press Ctrl+S or click the Save button at the top. Give any name if asked for a project name." : "Ctrl+S চাপুন অথবা উপরের Save বাটনে ক্লিক করুন। Project নাম চাইলে যেকোনো নাম দিন।", color: "#f59e0b" },
    { step: "৫", title: "Deploy করুন", desc: lang === "en" ? "Deploy → New Deployment → Type: Web App. Select Execute as: Me, Who has access: Anyone → Deploy." : "Deploy → New Deployment → Type: Web App। Execute as: Me, Who has access: Anyone সিলেক্ট করুন → Deploy করুন।", color: "#ef4444" },
    { step: "৬", title: lang === "en" ? "Grant Permission" : "Permission দিন", desc: lang === "en" ? "Google will ask for permission. Review Permissions → select your Account → Advanced → Allow." : "Google Permission চাইবে। Review Permissions → আপনার Account সিলেক্ট → Advanced → Allow করুন।", color: "#ec4899" },
    { step: "৭", title: lang === "en" ? "Copy Web App URL" : "Web App URL কপি করুন", desc: lang === "en" ? "After deploying, a URL will appear. Copy it and paste it as the Webhook URL in Xenox Short App's Float Sheet Set-Up." : "Deploy সম্পন্ন হলে একটি URL দেখাবে। সেটি কপি করুন এবং Xenox Short App-এর Float Sheet Set-Up-এ Webhook URL হিসেবে দিন।", color: "#10b981" },
  ];

  const ACTIONS_INFO = [
    { action: "APPEND", desc: lang === "en" ? "Adds new data — with Row Sync Logic" : "নতুন ডেটা যোগ করে — Row Sync Logic সহ", color: "#3b82f6" },
    { action: "DELETE", desc: lang === "en" ? "Deletes last row data on Long Press" : "Long Press-এ শেষ রো-র ডেটা মুছে দেয়", color: "#ef4444" },
  ];

  const [, navigate] = useLocation();
  const handleCopy = () => {
    navigate("/contact-support");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

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
            style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
          >
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none">App Script</h1>
            <p className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Google Sheet Integration
            </p>
          </div>
        </div>
      </header>

      <main className="relative flex-1 max-w-md mx-auto w-full px-4 pt-5 pb-10 space-y-4">

        {/* Version badges */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider"
            style={{
              background: "rgba(20,184,166,0.1)",
              border: "1px solid rgba(20,184,166,0.28)",
              color: "#2dd4bf",
            }}
          >
            <Zap className="w-3 h-3" fill="currentColor" />
            XENOX SCRIPT v2.0
          </div>
          <div
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}
          >
            2 Actions
          </div>
        </div>

        {/* ===== HIGHLIGHTED INFO CARD ===== */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(59,130,246,0.08) 100%)",
            border: "1px solid rgba(20,184,166,0.4)",
            boxShadow: "0 0 30px rgba(20,184,166,0.12), 0 0 60px rgba(20,184,166,0.05)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(20,184,166,0.2)", border: "1px solid rgba(20,184,166,0.4)" }}
            >
              <FileCode className="w-3.5 h-3.5" style={{ color: "#2dd4bf" }} />
            </div>
            <div>
              <p className="text-xs font-black text-white tracking-wide">XENOX SHORT — Google Apps Script</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Version 2.0 · Built for Xenox Short App</p>
            </div>
          </div>

          <div
            className="rounded-xl p-3 space-y-1.5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#2dd4bf" }}>HOW TO USE:</p>
            {(lang === "en" ? [
              "Open Google Sheet → Extensions → Apps Script",
              "Delete old code in Editor and paste this code",
              "Deploy → New Deployment → Web App",
              "Execute as: Me | Who has access: Anyone",
              "Paste the Deploy URL in Xenox Short App",
            ] : [
              "Google Sheet খুলুন → Extensions → Apps Script",
              "Editor-এর পুরনো কোড মুছে এই কোড পেস্ট করুন",
              "Deploy → New Deployment → Web App",
              "Execute as: Me | Who has access: Anyone",
              "Deploy URL টি Xenox Short App-এ দিন",
            ]).map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(20,184,166,0.2)", color: "#2dd4bf" }}
                >
                  {i + 1}
                </span>
                <p className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{line}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Warning (moved here so users notice it before opening the guide) */}
        <div
          className="flex gap-3 p-3.5 rounded-xl"
          style={{ background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.2)" }}
        >
          <span className="text-lg flex-shrink-0">⚠️</span>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            {lang === "en"
              ? <>When deploying, select <span style={{ color: "#fbbf24", fontWeight: "bold" }}>"Execute as: Me"</span> and{" "}<span style={{ color: "#fbbf24", fontWeight: "bold" }}>"Who has access: Anyone"</span>. Otherwise the App won't work.</>
              : <>Deploy করার সময় <span style={{ color: "#fbbf24", fontWeight: "bold" }}>"Execute as: Me"</span> এবং{" "}<span style={{ color: "#fbbf24", fontWeight: "bold" }}>"Who has access: Anyone"</span> সিলেক্ট করুন। না হলে App থেকে কাজ করবে না।</>
            }
          </p>
        </div>

        {/* Setup Guide */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <button
            data-testid="button-toggle-steps"
            onClick={() => setShowSteps(!showSteps)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm font-bold text-white">{t("script.guide_btn", lang)}</span>
            {showSteps
              ? <ChevronUp className="w-4 h-4 text-white/40" />
              : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>

          {showSteps && (
            <div className="px-4 pb-4 space-y-2">
              {SETUP_STEPS.map((s) => (
                <div
                  key={s.step}
                  className="flex gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5"
                    style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{s.title}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions Info */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
        >
          <button
            data-testid="button-toggle-actions"
            onClick={() => setShowActions(!showActions)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-white/40" />
              {t("script.actions_btn", lang)}
            </span>
            {showActions
              ? <ChevronUp className="w-4 h-4 text-white/40" />
              : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>

          {showActions && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {ACTIONS_INFO.map((a) => (
                <div
                  key={a.action}
                  className="p-3 rounded-xl"
                  style={{ background: `${a.color}0d`, border: `1px solid ${a.color}28` }}
                >
                  <span
                    className="text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: `${a.color}20`, color: a.color }}
                  >
                    {a.action}
                  </span>
                  <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {a.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{t("script.code_label", lang)}</p>
            <button
              data-testid="button-copy-code"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)", color: "#2dd4bf" }}
            >
              <Copy className="w-3 h-3" />
              {t("script.get_btn", lang)}
            </button>
          </div>

          {/* Code Box */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "#090e1a",
              border: "1px solid rgba(20,184,166,0.2)",
              boxShadow: "0 0 30px rgba(20,184,166,0.06), 0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            {/* Title bar */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 border-b"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(239,68,68,0.6)" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(234,179,8,0.6)" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(34,197,94,0.6)" }} />
              </div>
              <span className="ml-1 text-[10px] font-mono tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>
                xenox-short-script.gs
              </span>
              <div
                className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(20,184,166,0.15)", color: "#2dd4bf" }}
              >
                v2.0
              </div>
            </div>

            {/* Code — hidden for protection, copy button gives the real script */}
            <pre
              className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto"
              style={{
                color: "#7dd3c8",
                maxHeight: "420px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
{`// ── Xenox Short · Apps Script v2.0 ── //
// ──────────────────────────────────────
//
//  app Script টি নিতে "contact support" এ
//  যেয়ে "My Support Tickets" এ যাবেন
//  এবং উপরে এক কোনাই দেখবেন "+" icon আছে
//  icon টাই ক্লিক দুইটা ঘর show করবে
//
//  প্রথম ঘরে " script " লিখবেন
//  দ্বিতীয় ঘরে যেকোনো একটি লিখুন:
//   • give me script
//   • script needs
//   • script lagbe
//  তারপর " sent " option ক্লিক করবেন
//
//  তারপর " Notification bell " icon এ
//  আপনি script টা পেয়ে যাবেন
//
// ──────────────────────────────────────




               // THANK YOU //
                    ☺️❤️‍🩹`}
            </pre>
          </div>

          {/* Big Button — directs to support */}
          <button
            data-testid="button-copy-code-bottom"
            onClick={handleCopy}
            className="w-full mt-3 py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all"
            style={{
              background: "linear-gradient(135deg, #0f766e, #14b8a6)",
              border: "1px solid rgba(20,184,166,0.4)",
              color: "#ffffff",
              boxShadow: "0 0 24px rgba(20,184,166,0.3), 0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <Copy className="w-4 h-4" />
            {t("script.collect_btn", lang)}
          </button>
        </div>
      </main>
    </div>
  );
}
