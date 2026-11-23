import { Component, Suspense, lazy, useEffect, type ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPerformanceMode, isAndroidWebView, markSafeMode } from "@/lib/performanceMode";

const Home = lazy(() => import("@/pages/home"));
const FloatSheetSetup = lazy(() => import("@/pages/float-sheet-setup"));
const AppScript = lazy(() => import("@/pages/app-script"));
const LocalData = lazy(() => import("@/pages/local-data"));
const LocalSheet = lazy(() => import("@/pages/local-sheet"));
const CreateAcc = lazy(() => import("@/pages/CreateAcc"));
const ContactSupport = lazy(() => import("@/pages/contact-support"));
const TwoFactor = lazy(() => import("@/pages/two-factor"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Toaster = lazy(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));

function AppLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-9 h-9 rounded-full border-2 border-blue-500/30 border-t-blue-500 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-white/70">Loading...</p>
      </div>
    </div>
  );
}

function isChunkLoadError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err || "");
  const name = String(err?.name || "");
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /dynamically imported module/i.test(msg)
  );
}

function hardResetApp() {
  try {
    const removeMatch: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // Only wipe crash/safe-mode flags. User data (local data, 2FA codes,
      // local sheet, float config) is never touched here.
      if (k && (k === "xenox_safe_mode" || k === "xenox_last_boot_failed")) removeMatch.push(k);
    }
    removeMatch.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {}
  setTimeout(() => location.reload(), 50);
}

if (typeof window !== "undefined") {
  (window as any).__xenoxHardReset = hardResetApp;
  const handleChunkErr = (err: any) => {
    if (!isChunkLoadError(err)) return;
    try {
      const tries = Number(sessionStorage.getItem("xenox_chunk_retry") || "0");
      if (tries < 1) {
        sessionStorage.setItem("xenox_chunk_retry", String(tries + 1));
        location.reload();
      }
    } catch {
      location.reload();
    }
  };
  window.addEventListener("error", (e) => handleChunkErr(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => handleChunkErr(e.reason));
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    if (isChunkLoadError(err)) {
      try {
        const tries = Number(sessionStorage.getItem("xenox_chunk_retry") || "0");
        if (tries < 1) {
          sessionStorage.setItem("xenox_chunk_retry", String(tries + 1));
          location.reload();
        }
      } catch {
        location.reload();
      }
      return;
    }
    markSafeMode("react-error");
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-5">
          <div className="max-w-xs text-center space-y-3">
            <h1 className="text-lg font-bold">অ্যাপ লোড করা যায়নি</h1>
            <p className="text-sm text-white/60">একবার রিসেট করুন।</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Reload</button>
              <button onClick={hardResetApp} className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80">Reset & Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Suspense fallback={<AppLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/android_asset/web/index.html" component={Home} />
        <Route path="/float-sheet-setup" component={FloatSheetSetup} />
        <Route path="/app-script" component={AppScript} />
        <Route path="/local-data" component={LocalData} />
        <Route path="/local-sheet" component={LocalSheet} />
        <Route path="/create-acc" component={CreateAcc} />
        <Route path="/contact-support" component={ContactSupport} />
        <Route path="/2fa" component={TwoFactor} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const mode = getPerformanceMode();
  useEffect(() => {
    document.documentElement.dataset.xenoxAppReady = "true";
    if (isAndroidWebView()) {
      document.documentElement.dataset.androidWebview = "true";
    }
    (window as any).__xenoxBootOk?.();
    try {
      localStorage.removeItem("xenox_safe_mode");
      localStorage.removeItem("xenox_last_boot_failed");
      sessionStorage.removeItem("xenox_safe_reason");
      sessionStorage.removeItem("xenox_chunk_retry");
    } catch {}
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      {mode.safeMode ? (
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      ) : (
        <TooltipProvider>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <Toaster />
            </Suspense>
            <Router />
          </ErrorBoundary>
        </TooltipProvider>
      )}
    </QueryClientProvider>
  );
}

export default App;
