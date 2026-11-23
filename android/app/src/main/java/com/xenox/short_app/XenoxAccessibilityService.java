package com.xenox.short_app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Xenox Accessibility Service
 * Tracks focused input fields (username / password) across all apps.
 * BubbleService calls fillUsername() / fillPassword() to inject text.
 */
public class XenoxAccessibilityService extends AccessibilityService {

    // TEMPORARY diagnostic logging — added to trace the exact cause of the
    // "This service is malfunctioning" bug that survives across Bubble OFF→ON
    // cycles. Filter logcat with: adb logcat -s XenoxA11y:*
    private static final String TAG = "XenoxA11y";

    private static volatile XenoxAccessibilityService instance;

    // Application context kept for diagnostic logging even when instance is null
    // (e.g. so we can record "service unavailable" fill failures to the log file).
    private static volatile Context appCtx;

    // Most-recently detected nodes (may be null / stale)
    private AccessibilityNodeInfo lastUsernameNode;
    private AccessibilityNodeInfo lastPasswordNode;

    // Periodic flag re-assertion to prevent FLAG_RETRIEVE_INTERACTIVE_WINDOWS
    // from being silently dropped by Android after hours of idle time.
    private static final long FLAG_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
    private final Handler flagRefreshHandler = new Handler(Looper.getMainLooper());
    private final Runnable flagRefreshRunnable = new Runnable() {
        @Override public void run() {
            applyInfoThrottled();
            flagRefreshHandler.postDelayed(this, FLAG_REFRESH_INTERVAL_MS);
        }
    };

    // Single, centralized throttle for ALL setServiceInfo() IPC calls, regardless of
    // caller (periodic timer, manual fill-triggered refreshFlags(), or reconnect in
    // onServiceConnected()). Android's AccessibilityManagerService flags a service as
    // "malfunctioning" when setServiceInfo() is called too rapidly — a per-caller
    // throttle (e.g. one that only lived in BubbleService) does not protect against
    // two different call sites firing within the same window, since neither knows
    // about the other. Keeping the single guard here, next to the IPC call itself,
    // makes it impossible for any current or future caller to bypass it.
    private static final long MIN_REFRESH_INTERVAL_MS = 5000;
    private static volatile long lastGlobalRefreshMs = 0;

    /** Applies buildServiceInfo() via setServiceInfo(), but at most once every 5s. */
    private synchronized void applyInfoThrottled() {
        long now = System.currentTimeMillis();
        if (now - lastGlobalRefreshMs < MIN_REFRESH_INTERVAL_MS) return;
        lastGlobalRefreshMs = now;
        try { setServiceInfo(buildServiceInfo()); } catch (Exception ignored) {}
    }

    /**
     * Forces buildServiceInfo() to apply immediately, bypassing the throttle, and resets
     * the throttle window from this moment. Reserved for onServiceConnected() — a genuine
     * (re)connect must never be silently dropped by the throttle, since that would leave
     * the service running with stale/default flags until the next periodic tick (up to 5
     * minutes later). Resetting the window here still protects against a fill-triggered
     * refreshFlags() call that lands immediately after connect.
     */
    private synchronized void applyInfoForced() {
        lastGlobalRefreshMs = System.currentTimeMillis();
        try { setServiceInfo(buildServiceInfo()); } catch (Exception ignored) {}
    }

    // ── Public static API ────────────────────────────────────────────────────

    /** Our own package — nodes/windows from this package are never filled. */
    private static final String OWN_PKG = "com.xenox.short_app";

    public static boolean isRunning() {
        return instance != null;
    }

    /**
     * Re-asserts FLAG_RETRIEVE_INTERACTIVE_WINDOWS on the service.
     *
     * Android can silently drop this flag after a "malfunctioning" detection
     * cycle, causing getWindows() to return only the foreground window. Without
     * this flag, Chrome/Instagram login fields are invisible to the BFS scan
     * while the bubble overlay is in the foreground.
     *
     * Called by BubbleService once per fill attempt, before scanning. Safe to
     * call from any thread — setServiceInfo() is internally an IPC call.
     */
    public static void refreshFlags() {
        XenoxAccessibilityService svc = instance;
        if (svc == null) {
            Log.w(TAG, "refreshFlags(): instance is null — service not connected");
            return;
        }
        svc.applyInfoThrottled();
    }

    /**
     * Returns "ok" on success, "no_field" if no editable field found,
     * "fallback" if service unavailable or injection failed.
     */
    public static String fillUsername(String text) {
        XenoxAccessibilityService svc = instance;
        if (svc == null) {
            Log.w(TAG, "fillUsername: instance is null — service not connected");
            DiagLogger.warn(appCtx, TAG, "fillUsername: instance is null — service not connected -> result=service_unavailable");
            return "fallback";
        }
        Log.d(TAG, "fillUsername: start, isEnabledSystemWide should be true, instance=" + svc);

        // 1. Focused node (most accurate — the field the user's cursor is in)
        AccessibilityNodeInfo found = svc.findFocusedNode(false);
        Log.d(TAG, "fillUsername: findFocusedNode -> " + (found != null));

        // 2. BFS scan across all windows (works even when field isn't focused)
        if (found == null) {
            found = svc.findInWindow(false);
            Log.d(TAG, "fillUsername: findInWindow -> " + (found != null));
        }

        // 3. Last-resort: cached node — only if still valid after a refresh
        if (found == null) {
            AccessibilityNodeInfo cached = svc.lastUsernameNode;
            if (cached != null) {
                try {
                    boolean refreshed = cached.refresh();
                    Log.d(TAG, "fillUsername: cached node refresh() -> " + refreshed);
                    found = cached;
                } catch (Exception e) {
                    Log.e(TAG, "fillUsername: cached.refresh() threw", e);
                }
            }
        }

        if (found != null) {
            boolean ok = svc.doFill(found, text);
            Log.d(TAG, "fillUsername: doFill -> " + ok);
            DiagLogger.log(svc, TAG, "fillUsername: result=" + (ok ? "ok" : "fallback"));
            return ok ? "ok" : "fallback";
        }
        Log.w(TAG, "fillUsername: no_field");
        DiagLogger.warn(svc, TAG, "fillUsername: result=no_field");
        return "no_field";
    }

    public static String fillPassword(String text) {
        XenoxAccessibilityService svc = instance;
        if (svc == null) {
            Log.w(TAG, "fillPassword: instance is null — service not connected");
            DiagLogger.warn(appCtx, TAG, "fillPassword: instance is null — service not connected -> result=service_unavailable");
            return "fallback";
        }
        Log.d(TAG, "fillPassword: start, instance=" + svc);

        AccessibilityNodeInfo found = svc.findFocusedNode(true);
        Log.d(TAG, "fillPassword: findFocusedNode -> " + (found != null));
        if (found == null) {
            found = svc.findInWindow(true);
            Log.d(TAG, "fillPassword: findInWindow -> " + (found != null));
        }
        // Last-resort: cached node — only if still valid after a refresh
        if (found == null) {
            AccessibilityNodeInfo cached = svc.lastPasswordNode;
            if (cached != null) {
                try {
                    boolean refreshed = cached.refresh();
                    Log.d(TAG, "fillPassword: cached node refresh() -> " + refreshed);
                    found = cached;
                } catch (Exception e) {
                    Log.e(TAG, "fillPassword: cached.refresh() threw", e);
                }
            }
        }

        if (found != null) {
            boolean ok = svc.doFill(found, text);
            Log.d(TAG, "fillPassword: doFill -> " + ok);
            DiagLogger.log(svc, TAG, "fillPassword: result=" + (ok ? "ok" : "fallback"));
            return ok ? "ok" : "fallback";
        }
        Log.w(TAG, "fillPassword: no_field");
        DiagLogger.warn(svc, TAG, "fillPassword: result=no_field");
        return "no_field";
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        String msg = "onServiceConnected() — instance was " + (instance == null ? "null" : "NOT null (reconnect while old instance still set!)") + ", this=" + this;
        Log.i(TAG, msg);
        appCtx = getApplicationContext();
        DiagLogger.log(this, TAG, msg);
        instance = this;
        // Apply service info (single source of truth — also used by refreshFlags()).
        // Forced (not throttled): a reconnect must never be silently skipped.
        applyInfoForced();
        // Cancel any previously scheduled periodic refresh before rescheduling — defends
        // against onServiceConnected() firing more than once for the same instance
        // (would otherwise stack duplicate periodic Runnables on the Handler).
        flagRefreshHandler.removeCallbacks(flagRefreshRunnable);
        // Schedule periodic re-assertion of FLAG_RETRIEVE_INTERACTIVE_WINDOWS so it is
        // never silently dropped after hours of idle time (Android OEM battery optimisers
        // can clear this flag without calling onServiceConnected again).
        flagRefreshHandler.postDelayed(flagRefreshRunnable, FLAG_REFRESH_INTERVAL_MS);
    }

    @Override
    public boolean onUnbind(Intent intent) {
        // The system calling onUnbind() here (without the user touching system
        // Accessibility settings) is a strong signal that Android itself decided to
        // tear down the binding — e.g. as part of "malfunctioning" detection.
        String msg = "onUnbind() called — system is unbinding the service. instance=" + instance;
        Log.w(TAG, msg);
        DiagLogger.warn(this, TAG, msg);
        return super.onUnbind(intent);
    }

    /**
     * Builds the AccessibilityServiceInfo we always want applied.
     * Single source of truth used by both onServiceConnected() and refreshFlags().
     *
     * Why only TYPE_VIEW_FOCUSED:
     *   TYPE_WINDOW_CONTENT_CHANGED fires thousands of times/second across all apps
     *   (scroll, animation, text updates). Subscribing to it burns CPU and causes
     *   Android to flag the service as "malfunctioning" (ANR detection). We only
     *   need TYPE_VIEW_FOCUSED to track the last field the user tapped.
     *
     *   TYPE_VIEW_CLICKED was previously also subscribed but removed: click events
     *   fire on every tap in every app, adding unnecessary event processing overhead
     *   that contributes to "malfunctioning" detection. Focus events alone are
     *   sufficient — the user must focus a field before we can fill it anyway.
     *
     * Why FLAG_RETRIEVE_INTERACTIVE_WINDOWS:
     *   Without this, getWindows() only returns the foreground window. With the
     *   bubble overlay in front, Chrome/Instagram fields are invisible to the scan.
     *   This flag lets us see ALL windows simultaneously.
     */
    private AccessibilityServiceInfo buildServiceInfo() {
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes   = AccessibilityEvent.TYPE_VIEW_FOCUSED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags        = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                          | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        info.notificationTimeout = 0;
        return info;
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "onDestroy() called — instance=" + instance + " this=" + this, new Throwable("stack trace for onDestroy caller"));
        DiagLogger.warn(this, TAG, "onDestroy() called — instance=" + instance + " this=" + this);
        // Cancel periodic refresh before nulling instance.
        flagRefreshHandler.removeCallbacks(flagRefreshRunnable);
        // Null instance BEFORE calling super so isRunning() returns false immediately.
        // BubbleService's retry loop (up to 10 s / 50 × 200 ms) handles the gap while
        // Android reconnects the service after a process restart (Stop → Start cycle).
        instance = null;
        synchronized (this) {
            recycleNode(lastUsernameNode);
            recycleNode(lastPasswordNode);
            lastUsernameNode = null;
            lastPasswordNode = null;
        }
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Keep this handler as fast as possible — long work here causes "malfunctioning".
        // We only need to track the last focused editable field.
        if (event == null) return;
        // Only TYPE_VIEW_FOCUSED is subscribed — no need to check event type.
        if (event.getEventType() != AccessibilityEvent.TYPE_VIEW_FOCUSED) return;
        try {
            AccessibilityNodeInfo node = event.getSource();
            if (node != null) classifyAndStore(node);
        } catch (Exception e) {
            Log.e(TAG, "onAccessibilityEvent: classifyAndStore threw", e);
            DiagLogger.error(this, TAG, "onAccessibilityEvent: classifyAndStore threw: " + e, e);
            // Never let an uncaught exception escape — that would crash the service.
        }
    }

    @Override
    public void onInterrupt() {
        // System calls this when it wants the service to stop responding to events
        // (e.g. right before considering it unresponsive/malfunctioning).
        String msg = "onInterrupt() called — system signaled interrupt. instance=" + instance;
        Log.w(TAG, msg);
        DiagLogger.warn(this, TAG, msg);
    }

    // ── Field classification ─────────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    private void classifyAndStore(AccessibilityNodeInfo node) {
        if (!node.isEditable()) return;

        // Never store nodes from our own app (login form, search box, etc.).
        // If we did, lastUsernameNode would point at the Xenox app's own fields
        // after the user navigates there to tap Start, and the next fill attempt
        // would try to inject into the Xenox app instead of Chrome/Instagram.
        CharSequence pkg = node.getPackageName();
        if (OWN_PKG.equals(pkg != null ? pkg.toString() : "")) return;

        int inputType = node.getInputType();

        if (isPasswordType(inputType)) {
            recycleNode(lastPasswordNode);
            lastPasswordNode = AccessibilityNodeInfo.obtain(node);
        } else if (inputType == 0 || isTextType(inputType)) {
            // inputType == 0 covers WebView/Chrome inputs — store as username candidate
            recycleNode(lastUsernameNode);
            lastUsernameNode = AccessibilityNodeInfo.obtain(node);
        }
    }

    private boolean isPasswordType(int inputType) {
        int var = inputType & InputType.TYPE_MASK_VARIATION;
        return var == InputType.TYPE_TEXT_VARIATION_PASSWORD
            || var == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            || var == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD;
    }

    private boolean isTextType(int inputType) {
        int cls = inputType & InputType.TYPE_MASK_CLASS;
        return cls == InputType.TYPE_CLASS_TEXT
            || cls == InputType.TYPE_CLASS_PHONE
            || cls == InputType.TYPE_CLASS_NUMBER;
    }

    private boolean looksLikeUsername(AccessibilityNodeInfo node) {
        String hint = "";
        try {
            java.lang.reflect.Method m = node.getClass().getMethod("getHint");
            CharSequence h = (CharSequence) m.invoke(node);
            hint = h != null ? h.toString() : "";
        } catch (Exception ignored) {}
        String[] parts = {
            hint,
            str(node.getContentDescription()),
            str(node.getViewIdResourceName()),
            str(node.getText())
        };
        String combined = join(parts).toLowerCase();
        for (String kw : new String[]{"user","email","phone","mobile","login","account","id",
                "\u09A8\u09BE\u09AE","\u0987\u09AE\u09C7\u0987\u09B2","\u09AE\u09CB\u09AC\u09BE\u0987\u09B2"}) {
            if (combined.contains(kw)) return true;
        }
        int var = node.getInputType() & InputType.TYPE_MASK_VARIATION;
        return var == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            || var == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS;
    }

    // ── Primary focus-based node finder ──────────────────────────────────────

    /**
     * Uses findFocus() on each window root — this is the most accurate method because
     * it finds the node the user actually has their cursor in. Works for both native
     * EditText and WebView inputs.
     */
    private AccessibilityNodeInfo findFocusedNode(boolean wantPassword) {
        List<AccessibilityNodeInfo> roots = collectRoots();
        for (AccessibilityNodeInfo root : roots) {
            if (root == null) continue;
            try {
                // Try input focus first (cursor is in this field)
                AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                if (focused != null && focused.isEditable()) {
                    boolean isPwd = isPasswordType(focused.getInputType());
                    if (wantPassword && isPwd) return focused;
                    if (!wantPassword && !isPwd) return focused;
                    recycleNode(focused);
                }

                // Try accessibility focus as secondary
                AccessibilityNodeInfo aFocused = root.findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY);
                if (aFocused != null && aFocused.isEditable()) {
                    boolean isPwd = isPasswordType(aFocused.getInputType());
                    if (wantPassword && isPwd) return aFocused;
                    if (!wantPassword && !isPwd) return aFocused;
                    recycleNode(aFocused);
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    // ── BFS window scan (fallback) ────────────────────────────────────────────

    /**
     * BFS scan across ALL windows to find username or password field.
     *
     * Key fix vs old version:
     * - Removed the "inputType != 0" gate — WebView/Chrome inputs report inputType=0
     *   but ARE editable. We now rely on isEditable() as the primary filter.
     * - For username: accepts ANY editable non-password field as a last resort,
     *   not just keyword-matched ones.
     */
    private AccessibilityNodeInfo findInWindow(boolean wantPassword) {
        try {
            List<AccessibilityNodeInfo> roots = collectRoots();

            AccessibilityNodeInfo firstTextField = null; // last resort: any editable non-pwd

            for (AccessibilityNodeInfo root : roots) {
                if (root == null) continue;
                Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
                queue.add(root);
                while (!queue.isEmpty()) {
                    AccessibilityNodeInfo n = queue.poll();
                    if (n == null) continue;

                    // isEditable() is the primary gate — no inputType filter
                    if (n.isEditable()) {
                        int inputType = n.getInputType();
                        boolean isPwd = isPasswordType(inputType);

                        if (wantPassword && isPwd) return n;

                        if (!wantPassword && !isPwd) {
                            if (looksLikeUsername(n)) return n;
                            if (firstTextField == null) firstTextField = n;
                        }
                    }

                    for (int i = 0; i < n.getChildCount(); i++) {
                        AccessibilityNodeInfo child = n.getChild(i);
                        if (child != null) queue.add(child);
                    }
                }
            }

            // No keyword-matched username field — return the first editable non-pwd field we saw
            if (!wantPassword && firstTextField != null) return firstTextField;

        } catch (Exception e) {
            Log.e(TAG, "findInWindow: threw (wantPassword=" + wantPassword + ")", e);
            DiagLogger.error(this, TAG, "findInWindow: threw (wantPassword=" + wantPassword + "): " + e, e);
        }
        return null;
    }

    // ── Collect all window roots ──────────────────────────────────────────────

    private List<AccessibilityNodeInfo> collectRoots() {
        List<AccessibilityNodeInfo> roots = new ArrayList<>();
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                List<android.view.accessibility.AccessibilityWindowInfo> windows = getWindows();
                if (windows != null) {
                    for (android.view.accessibility.AccessibilityWindowInfo w : windows) {
                        int wType = w.getType();

                        // Skip accessibility-overlay windows (usually system UI hints)
                        if (wType == android.view.accessibility.AccessibilityWindowInfo.TYPE_ACCESSIBILITY_OVERLAY) {
                            continue;
                        }

                        AccessibilityNodeInfo r = w.getRoot();
                        if (r == null) continue;

                        // Skip windows that belong to our own app (the bubble overlay
                        // runs as TYPE_APPLICATION_OVERLAY, not TYPE_ACCESSIBILITY_OVERLAY,
                        // so the type check above does NOT catch it).
                        // Without this skip, BFS might fill our own bubble's WebView nodes
                        // instead of the target app's login field.
                        CharSequence rootPkg = r.getPackageName();
                        if (OWN_PKG.equals(rootPkg != null ? rootPkg.toString() : "")) {
                            r.recycle();
                            continue;
                        }

                        roots.add(r);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "collectRoots: getWindows() scan threw", e);
            DiagLogger.error(this, TAG, "collectRoots: getWindows() scan threw: " + e, e);
        }

        // Fallback: active window (covers API < 21 and cases where getWindows() returned null).
        // Apply the same own-app filter here.
        try {
            AccessibilityNodeInfo active = getRootInActiveWindow();
            if (active != null) {
                CharSequence activePkg = active.getPackageName();
                if (OWN_PKG.equals(activePkg != null ? activePkg.toString() : "")) {
                    active.recycle();
                } else {
                    roots.add(active);
                }
            }
        } catch (Exception ignored) {}

        return roots;
    }

    // ── Inject text ──────────────────────────────────────────────────────────

    private boolean doFill(AccessibilityNodeInfo node, String text) {
        if (node == null) return false;
        try {
            // If the node is stale (detached from the view tree), bail out immediately.
            // Performing actions on a stale node always fails silently.
            boolean refreshed = node.refresh();
            Log.d(TAG, "doFill: node.refresh() -> " + refreshed);
            DiagLogger.log(this, TAG, "doFill: node.refresh() -> " + refreshed);
            if (!refreshed) return false;

            // Step 1: Give the field accessibility focus so the OS sees it as the target
            boolean a1 = node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS);

            // Step 2: Click + focus to activate keyboard / cursor
            boolean a2 = node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            boolean a3 = node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            Log.d(TAG, "doFill: ACCESSIBILITY_FOCUS=" + a1 + " CLICK=" + a2 + " FOCUS=" + a3);

            // Brief pause for the field to accept input (runs on background thread — safe)
            try { Thread.sleep(120); } catch (InterruptedException ignored) {}

            // Step 3: ACTION_SET_TEXT (API 21+, most reliable for native EditText)
            Bundle args = new Bundle();
            args.putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            boolean setTextOk = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
            Log.d(TAG, "doFill: ACTION_SET_TEXT -> " + setTextOk);
            DiagLogger.log(this, TAG, "doFill: ACCESSIBILITY_FOCUS=" + a1 + " CLICK=" + a2 + " FOCUS=" + a3 + " SET_TEXT=" + setTextOk);
            if (setTextOk) {
                // Move cursor to end
                Bundle sel = new Bundle();
                sel.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, text.length());
                sel.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, text.length());
                node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, sel);
                return true;
            }

            // Step 4: Clipboard fallback — write to clipboard then ACTION_PASTE into the field
            try {
                android.content.ClipboardManager cm = (android.content.ClipboardManager)
                    getSystemService(CLIPBOARD_SERVICE);
                if (cm != null) {
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("xenox", text));
                    // Small delay so clipboard write settles before paste
                    try { Thread.sleep(80); } catch (InterruptedException ignored2) {}
                    boolean pasteOk = node.performAction(AccessibilityNodeInfo.ACTION_PASTE);
                    Log.d(TAG, "doFill: ACTION_PASTE fallback -> " + pasteOk);
                    DiagLogger.log(this, TAG, "doFill: ACTION_PASTE fallback -> " + pasteOk);
                    if (pasteOk) return true;
                }
            } catch (Exception e) {
                Log.e(TAG, "doFill: clipboard/paste fallback threw", e);
                DiagLogger.error(this, TAG, "doFill: clipboard/paste fallback threw: " + e, e);
            }

        } catch (Exception e) {
            Log.e(TAG, "doFill: threw", e);
            DiagLogger.error(this, TAG, "doFill: threw: " + e, e);
        }
        return false;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    private void recycleNode(AccessibilityNodeInfo n) {
        if (n != null) {
            try { n.recycle(); } catch (Exception ignored) {}
        }
    }

    private String str(CharSequence cs) { return cs != null ? cs.toString() : ""; }

    private String join(String[] parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) sb.append(p).append(" ");
        return sb.toString();
    }
}
