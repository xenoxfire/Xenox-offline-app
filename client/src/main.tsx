import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyPerformanceMode } from "./lib/performanceMode";

try {
  localStorage.removeItem("xenox_safe_mode");
  localStorage.removeItem("xenox_last_boot_failed");
  sessionStorage.removeItem("xenox_safe_reason");
} catch {}

applyPerformanceMode();

const rootEl = document.getElementById("root");

if (!rootEl) {
  document.body.innerHTML = "<div style='min-height:100vh;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui;padding:20px;text-align:center'>App container missing. Please reload.</div>";
} else {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error("Render crashed:", err);
    rootEl.innerHTML = "<div style='min-height:100vh;background:#050505;color:#e5e7eb;display:flex;align-items:center;justify-content:center;font-family:system-ui;padding:20px;text-align:center'><div style='max-width:320px'><div style='font-weight:800;margin-bottom:8px'>অ্যাপ চালু করা যায়নি</div><div style='font-size:13px;color:#9ca3af;margin-bottom:14px'>একবার রিলোড করুন।</div><button onclick='location.reload()' style='background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 16px;font-weight:700'>Reload</button></div></div>";
  }
}
