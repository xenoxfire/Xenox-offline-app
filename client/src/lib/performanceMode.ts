type PerformanceMode = {
  androidWebView: boolean;
  lowEnd: boolean;
  slowNetwork: boolean;
  safeMode: boolean;
  timerScale: number;
};

const SAFE_MODE_KEY = "xenox_safe_mode";
const CRASH_KEY = "xenox_last_boot_failed";

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {}
}

export function isAndroidWebView() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return Boolean((window as any).XenoxAndroid) || /\bwv\b|; wv\)|Version\/\d+\.\d+ Chrome\/.+ Mobile Safari\//i.test(ua);
}

export function getPerformanceMode(): PerformanceMode {
  if (typeof window === "undefined") {
    return { androidWebView: false, lowEnd: false, slowNetwork: false, safeMode: false, timerScale: 1 };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const memory = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  const connection = nav.connection;
  const slowNetwork = Boolean(connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType || ""));
  const androidWebView = isAndroidWebView();
  const lowEnd = androidWebView || (typeof memory === "number" && memory <= 2) || (typeof cores === "number" && cores <= 2) || slowNetwork;
  const safeMode = lowEnd || readFlag(SAFE_MODE_KEY) || readFlag(CRASH_KEY) || new URLSearchParams(location.search).has("safeMode");
  return {
    androidWebView,
    lowEnd,
    slowNetwork,
    safeMode,
    timerScale: safeMode ? 4 : lowEnd ? 2 : 1,
  };
}

export function isSafeMode() {
  return getPerformanceMode().safeMode;
}

export function markSafeMode(reason?: string) {
  writeFlag(SAFE_MODE_KEY, true);
  try {
    sessionStorage.setItem("xenox_safe_reason", reason || "performance");
  } catch {}
  applyPerformanceMode();
}

export function markBootStarted() {
  writeFlag(CRASH_KEY, true);
}

export function markBootComplete() {
  writeFlag(CRASH_KEY, false);
}

export function applyPerformanceMode() {
  if (typeof document === "undefined") return getPerformanceMode();
  const mode = getPerformanceMode();
  document.documentElement.dataset.webview = mode.androidWebView ? "true" : "false";
  document.documentElement.dataset.lowEnd = mode.lowEnd ? "true" : "false";
  document.documentElement.dataset.safeMode = mode.safeMode ? "true" : "false";
  return mode;
}

export function getTimerDelay(baseMs: number) {
  return Math.max(baseMs, Math.round(baseMs * getPerformanceMode().timerScale));
}

export function isOffline() {
  return typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
}