import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ChevronLeft } from "lucide-react";

type Platform = "instagram" | "facebook" | null;

type ButtonAction =
  | { type: "direct"; url: string }
  | { type: "cookies" }
  | { type: "cleardata" };

interface NavItem {
  label: string;
  action: ButtonAction;
}

const IG_HOME = "https://www.instagram.com/";
const FB_HOME = "https://www.facebook.com/";

const IG_NAV: NavItem[] = [
  { label: "Sign Up",     action: { type: "direct",  url: "https://www.instagram.com/accounts/emailsignup/" } },
  { label: "Log In",      action: { type: "direct",  url: "https://www.instagram.com/accounts/login/" } },
  { label: "2FA",         action: { type: "direct",  url: "https://www.instagram.com/accounts/two_factor_authentication/" } },
  { label: "Cookies",     action: { type: "cookies" } },
  { label: "Pass Change", action: { type: "direct",  url: "https://www.instagram.com/accounts/password/change/" } },
  { label: "Email",       action: { type: "direct",  url: "https://www.instagram.com/accounts/edit/" } },
  { label: "Clear Data",  action: { type: "cleardata" } },
];

const FB_NAV: NavItem[] = [
  { label: "Sign Up",     action: { type: "direct",  url: "https://www.facebook.com/r.php" } },
  { label: "Log In",      action: { type: "direct",  url: "https://www.facebook.com/login/" } },
  { label: "2FA",         action: { type: "direct",  url: "https://www.facebook.com/settings?tab=security" } },
  { label: "Cookies",     action: { type: "cookies" } },
  { label: "Pass Change", action: { type: "direct",  url: "https://www.facebook.com/settings?tab=account" } },
  { label: "Email",       action: { type: "direct",  url: "https://www.facebook.com/settings?tab=account" } },
  { label: "Clear Data",  action: { type: "cleardata" } },
];

function InstagramLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <radialGradient id="ig_pg" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#ffd600" />
          <stop offset="50%" stopColor="#ff0069" />
          <stop offset="100%" stopColor="#d300c4" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#ig_pg)" />
      <rect x="14" y="14" width="20" height="20" rx="6" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="24" cy="24" r="5" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="31.5" cy="16.5" r="1.5" fill="white" />
    </svg>
  );
}

function FacebookLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="#1877F2" />
      <path d="M29 48V30h6l1-7h-7v-4c0-2 1-3 3-3h4v-6s-2-1-5-1c-5 0-9 3-9 9v5h-6v7h6v18h7z" fill="white" />
    </svg>
  );
}


/* ── Selection Screen ── */
function SelectionScreen({ onSelect }: { onSelect: (p: Platform) => void }) {
  const [, navigate] = useLocation();
  const [pressed, setPressed] = useState<string | null>(null);

  const handlePress = (p: Platform) => {
    setPressed(p as string);
    setTimeout(() => { setPressed(null); onSelect(p); }, 140);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />

      <header className="relative z-50 border-b border-white/[0.06]"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-md mx-auto px-5 py-3.5 flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black tracking-tight text-white">Create Account</h1>
            <p className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>In-App Browser</p>
          </div>
        </div>
      </header>

      <main className="relative flex-1 max-w-md mx-auto w-full px-4 pt-8 pb-10">
        <p className="text-center text-xs mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>একটি প্ল্যাটফর্ম বেছে নিন</p>
        <div className="space-y-4">

          {/* Instagram */}
          <button onClick={() => handlePress("instagram")} className="w-full rounded-2xl overflow-hidden text-left"
            style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(236,72,153,0.25)",
              boxShadow: "0 0 32px rgba(200,50,150,0.1), 0 4px 20px rgba(0,0,0,0.4)",
              transform: pressed === "instagram" ? "scale(0.97)" : "scale(1)", transition: "transform 0.12s ease",
            }}>
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.07]"
                style={{ background: "radial-gradient(ellipse 80% 60% at 30% 50%, #ff6080 0%, #c026d3 60%, transparent 100%)" }} />
              <div className="relative flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#f9731680,#ec489960,#a855f760)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 24px rgba(236,72,153,0.4)" }}>
                  <InstagramLogo size={36} />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-black text-white">Instagram</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>App-এর ভেতরেই চালান</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {["Sign Up", "Log In", "2FA", "Cookies", "Pass"].map(tag => (
                      <span key={tag} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(236,72,153,0.15)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.25)" }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-pink-400 flex-shrink-0" />
              </div>
            </div>
          </button>

          {/* Facebook */}
          <button onClick={() => handlePress("facebook")} className="w-full rounded-2xl overflow-hidden text-left"
            style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(24,119,242,0.3)",
              boxShadow: "0 0 32px rgba(24,119,242,0.1), 0 4px 20px rgba(0,0,0,0.4)",
              transform: pressed === "facebook" ? "scale(0.97)" : "scale(1)", transition: "transform 0.12s ease",
            }}>
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.07]"
                style={{ background: "radial-gradient(ellipse 80% 60% at 30% 50%, #1877F2 0%, #0a5fde 60%, transparent 100%)" }} />
              <div className="relative flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#1877F280,#0a5fde60)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 24px rgba(24,119,242,0.4)" }}>
                  <FacebookLogo size={36} />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-black text-white">Facebook</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>App-এর ভেতরেই চালান</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {["Sign Up", "Log In", "2FA", "Cookies", "Pass"].map(tag => (
                      <span key={tag} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(24,119,242,0.15)", color: "#60a5fa", border: "1px solid rgba(24,119,242,0.3)" }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-[10px] mt-8" style={{ color: "rgba(255,255,255,0.18)" }}>
          In-App Browser — কোথাও যাওয়া লাগবে না
        </p>
      </main>
    </div>
  );
}


/* ── Browser Screen ── */
// The React UI renders the top bar only. The native platform WebView is
// attached below the top bar (measured in screen pixels and passed to
// XenoxAndroid.attachPlatformWebView). Back button detaches the native WebView.
function BrowserScreen({ platform, onBack }: { platform: "instagram" | "facebook"; onBack: () => void }) {
  const isIG = platform === "instagram";
  const nav = isIG ? IG_NAV : FB_NAV;
  const homeUrl = isIG ? IG_HOME : FB_HOME;
  const accent = isIG ? "#f472b6" : "#60a5fa";
  const accentGlow = isIG ? "rgba(236,72,153,0.45)" : "rgba(24,119,242,0.45)";

  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const topBarRef = useRef<HTMLDivElement>(null);

  // Attach native platform WebView below the top bar on mount;
  // detach on unmount (when user goes back to selection screen).
  useEffect(() => {
    const bridge = (window as any).XenoxAndroid;
    if (!bridge?.attachPlatformWebView) return;

    const attach = () => {
      if (!topBarRef.current) return;
      const rect = topBarRef.current.getBoundingClientRect();
      const topPx = Math.round(rect.bottom * (window.devicePixelRatio || 1));
      bridge.attachPlatformWebView(platform, topPx);
    };

    // Wait a tick for the layout to settle before measuring
    const timer = setTimeout(attach, 80);
    return () => {
      clearTimeout(timer);
      if (bridge?.detachPlatformWebView) bridge.detachPlatformWebView();
    };
  }, [platform]);

  function handleNavClick(item: NavItem) {
    const bridge = (window as any).XenoxAndroid;
    if (item.action.type === "cookies") {
      // Native side: CookieManager.getCookie → copy to clipboard → show toast
      if (bridge?.copyPlatformCookies) bridge.copyPlatformCookies();
      return;
    }
    if (item.action.type === "cleardata") {
      // Only clear Instagram/Facebook WebView data — do NOT touch HBX Short session
      if (bridge?.clearPlatformWebViewData) bridge.clearPlatformWebViewData(homeUrl);
      setActiveLabel(null);
      return;
    }
    if (item.action.type === "direct") {
      setActiveLabel(item.label);
      if (bridge?.navigatePlatformWebView) bridge.navigatePlatformWebView(item.action.url);
    }
  }

  function handleBack() {
    // detach handled by useEffect cleanup
    onBack();
  }

  return (
    <div className="flex flex-col bg-black" style={{ height: "100dvh" }}>

      {/* Top bar — measured so native WebView starts exactly below it */}
      <div ref={topBarRef} className="flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.97)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Title row */}
        <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
          <button onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-5 h-5 flex-shrink-0">
              {isIG ? <InstagramLogo size={20} /> : <FacebookLogo size={20} />}
            </div>
            <span className="font-black text-[13px] text-white leading-none">
              {isIG ? "Instagram" : "Facebook"}
            </span>
          </div>
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: accent, boxShadow: `0 0 8px ${accentGlow}` }} />
        </div>

        {/* Scrollable nav buttons */}
        <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {nav.map(item => {
            const active    = activeLabel === item.label;
            const isClear   = item.action.type === "cleardata";
            const isCookies = item.action.type === "cookies";
            const sharedCls = "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap";
            const btnStyle: React.CSSProperties = {
              background: active
                ? (isClear ? "rgba(239,68,68,0.18)" : isCookies ? "rgba(234,179,8,0.18)" : accent)
                : "rgba(255,255,255,0.08)",
              color: active
                ? (isClear ? "#f87171" : isCookies ? "#fbbf24" : "#000")
                : isClear   ? "rgba(248,113,113,0.75)"
                : isCookies ? "rgba(251,191,36,0.85)"
                : "rgba(255,255,255,0.65)",
              border: `1px solid ${active
                ? (isClear ? "rgba(239,68,68,0.4)" : isCookies ? "rgba(234,179,8,0.4)" : accent)
                : isClear   ? "rgba(239,68,68,0.2)"
                : isCookies ? "rgba(234,179,8,0.2)"
                : "rgba(255,255,255,0.1)"}`,
              boxShadow: active ? `0 0 12px ${accentGlow}` : "none",
              transition: "all 0.15s ease",
            };
            return (
              <button key={item.label} onClick={() => handleNavClick(item)}
                className={sharedCls} style={btnStyle}>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transparent spacer — native platform WebView fills this area */}
      <div className="flex-1" style={{ background: "#000" }} />

      <style>{`div::-webkit-scrollbar{display:none;}`}</style>
    </div>
  );
}

export default function CreateAcc() {
  const [platform, setPlatform] = useState<Platform>(null);
  if (platform) return <BrowserScreen platform={platform} onBack={() => setPlatform(null)} />;
  return <SelectionScreen onSelect={setPlatform} />;
}
