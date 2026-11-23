package com.xenox.short_app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.provider.Settings;
import android.webkit.WebSettings;
import androidx.core.app.NotificationManagerCompat;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class BubbleService extends Service {

    // TEMPORARY diagnostic logging — see XenoxAccessibilityService for context.
    // Filter logcat with: adb logcat -s BubbleSvc:*
    private static final String TAG = "BubbleSvc";

    private static final String CHANNEL_ID = "xenox_bubble_service";
    private static final int    NOTIF_ID   = 1001;

    private WindowManager              windowManager;
    private Handler                    mainHandler;
    private DragInterceptLayout        rootView;
    private WebView                    bubbleWebView;
    private WindowManager.LayoutParams wParams;

    private int     screenWidth, screenHeight;
    private int     ballSize;
    private boolean isExpanded  = false;
    private boolean pageLoaded  = false;
    private Runnable pendingExpand = null;
    // Saved ball position before expanding — restored exactly on collapse
    private int     savedBallX  = -1;
    private int     savedBallY  = -1;

    // ── DragInterceptLayout ───────────────────────────────────────────────────
    // When collapsed, intercepts ALL touches before WebView can consume them.
    // Handles drag and tap-to-expand directly in onTouchEvent.
    // When expanded, returns false so WebView gets everything.

    private class DragInterceptLayout extends FrameLayout {
        private int   initX, initY;
        private float initTouchX, initTouchY;
        private boolean moved = false;

        DragInterceptLayout(Context ctx) { super(ctx); }

        @Override
        public boolean onInterceptTouchEvent(MotionEvent ev) {
            return !isExpanded; // Intercept when collapsed
        }

        @Override
        public boolean onTouchEvent(MotionEvent ev) {
            if (isExpanded) return super.onTouchEvent(ev);
            switch (ev.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    initX      = wParams.x;
                    initY      = wParams.y;
                    initTouchX = ev.getRawX();
                    initTouchY = ev.getRawY();
                    moved      = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = ev.getRawX() - initTouchX;
                    float dy = ev.getRawY() - initTouchY;
                    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
                    if (moved) {
                        wParams.x = Math.max(0, Math.min(initX + (int) dx, screenWidth  - ballSize));
                        wParams.y = Math.max(0, Math.min(initY + (int) dy, screenHeight - ballSize));
                        try { windowManager.updateViewLayout(rootView, wParams); } catch (Exception ignored) {}
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) expandBubble();
                    return true;
            }
            return super.onTouchEvent(ev);
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "onCreate() — process pid=" + android.os.Process.myPid());
        DiagLogger.log(this, TAG, "onCreate() — process pid=" + android.os.Process.myPid());
        mainHandler   = new Handler(Looper.getMainLooper());
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        screenWidth   = getResources().getDisplayMetrics().widthPixels;
        screenHeight  = getResources().getDisplayMetrics().heightPixels;
        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        Log.i(TAG, "onStartCommand: action=" + action + " a11yRunning=" + XenoxAccessibilityService.isRunning() + " pid=" + android.os.Process.myPid());
        DiagLogger.log(this, TAG, "onStartCommand: action=" + action + " a11yRunning=" + XenoxAccessibilityService.isRunning() + " pid=" + android.os.Process.myPid());
        if ("START".equals(action)) {
            mainHandler.post(this::showBubble);
        } else if ("HIDE".equals(action)) {
            // Hide the overlay UI but keep this Service (and therefore the app
            // process) alive in the background. This is the permanent fix for
            // "turn bubble off then on again → auto-fill stops working until
            // Accessibility is manually toggled": that bug happened because
            // fully killing the service (stopService) let Android kill the whole
            // process, and the OS's re-binding of XenoxAccessibilityService after
            // a fresh process start is unreliable on some OEMs (e.g. MIUI). By
            // never letting the process die, the accessibility connection never
            // needs to be re-established at all.
            //
            // Guard: if nothing is currently showing there is nothing to hide;
            // skip the post() to avoid a redundant no-op on the main thread.
            if (rootView != null) mainHandler.post(this::hideBubble);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "onDestroy() called — pid=" + android.os.Process.myPid(), new Throwable("stack trace for onDestroy caller"));
        DiagLogger.warn(this, TAG, "onDestroy() called — pid=" + android.os.Process.myPid());
        mainHandler.post(this::hideBubble);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Show bubble ───────────────────────────────────────────────────────────

    private void showBubble() {
        if (rootView != null) return;
        pageLoaded = false;

        // MUST read ballSize BEFORE buildBubbleHtml() so CSS pixel values are correct
        ballSize = readLauncherSize();

        bubbleWebView = new WebView(this);
        bubbleWebView.setBackgroundColor(0x00000000);
        // SOFTWARE layer is required for WebView transparency on Android.
        // HARDWARE layer breaks alpha/transparency and causes the bubble to render as a square.
        bubbleWebView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);

        WebSettings ws = bubbleWebView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) ws.setOffscreenPreRaster(true);
        ws.setUserAgentString(ws.getUserAgentString() + " XenoxAndroidApp/1.0 XenoxBubble/1.0");

        bubbleWebView.setWebChromeClient(new WebChromeClient());
        bubbleWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;
                if (pendingExpand != null) {
                    mainHandler.post(pendingExpand);
                    pendingExpand = null;
                }
            }
        });

        bubbleWebView.addJavascriptInterface(new BubbleBridge(), "XenoxAndroid");
        bubbleWebView.loadDataWithBaseURL(
            MainActivity.SERVER_URL,
            buildBubbleHtml(), "text/html", "UTF-8", null
        );

        rootView = new DragInterceptLayout(this);
        rootView.addView(bubbleWebView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        wParams = new WindowManager.LayoutParams(
            ballSize, ballSize,
            screenWidth  - ballSize - dpToPx(12),
            screenHeight - ballSize - dpToPx(130),
            overlayType,
            collapsedFlags(),
            PixelFormat.TRANSLUCENT
        );
        wParams.gravity = Gravity.TOP | Gravity.START;

        windowManager.addView(rootView, wParams);
    }

    private int readLauncherSize() {
        try {
            String cfg = getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                .getString("float_config", "{}");
            JSONObject json = new JSONObject(cfg);
            int sz = json.optInt("launcherSize", 62);
            return dpToPx(Math.max(40, Math.min(90, sz)));
        } catch (Exception e) {
            return dpToPx(62);
        }
    }

    // ── Flags ─────────────────────────────────────────────────────────────────

    private int collapsedFlags() {
        return WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
             | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
             | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
             | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
    }

    private int expandedFlags() {
        return WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
             | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
             | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
             | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH;
    }

    // ── Expand ────────────────────────────────────────────────────────────────

    private void expandBubble() {
        if (rootView == null || isExpanded) return;
        isExpanded = true;

        // Save exact ball position so collapseBubble() can restore it
        savedBallX = wParams.x;
        savedBallY = wParams.y;

        int btnSizeDp = 52, numCols = 3;
        try {
            String cfgJson = getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                .getString("float_config", "{}");
            JSONObject cfg = new JSONObject(cfgJson);
            btnSizeDp = Math.max(32, Math.min(80, cfg.optInt("buttonSize", 52)));
            String colStr = cfg.optString("columns", "A,B,C");
            numCols = colStr.isEmpty() ? 3 : colStr.split(",").length;
        } catch (Exception ignored) {}

        int numBtns = numCols + 2;
        int panelW  = dpToPx(btnSizeDp + 18);
        int panelH  = numBtns * (dpToPx(btnSizeDp) + dpToPx(8)) + dpToPx(20);

        boolean isOnLeft = (savedBallX + ballSize / 2) < (screenWidth / 2);

        wParams.flags  = expandedFlags();
        wParams.width  = panelW;
        wParams.height = panelH;

        if (isOnLeft) {
            wParams.x = savedBallX;
        } else {
            wParams.x = savedBallX + ballSize - panelW;
            if (wParams.x < 0) wParams.x = dpToPx(6);
        }

        if (wParams.y + panelH > screenHeight) wParams.y = screenHeight - panelH - dpToPx(20);
        if (wParams.y < 0) wParams.y = 0;

        try { windowManager.updateViewLayout(rootView, wParams); } catch (Exception ignored) {}

        Runnable runExpand = () ->
            bubbleWebView.evaluateJavascript("window.xenoxExpand && window.xenoxExpand(true);", null);

        if (pageLoaded) {
            mainHandler.postDelayed(runExpand, 80);
        } else {
            pendingExpand = runExpand;
        }
    }

    // ── Collapse ──────────────────────────────────────────────────────────────

    private void collapseBubble() {
        if (rootView == null || !isExpanded) return;
        isExpanded = false;

        bubbleWebView.evaluateJavascript("window.xenoxExpand && window.xenoxExpand(false);", null);

        // Snapshot saved position now (before any async delay clears it)
        final int restoreX = (savedBallX >= 0) ? savedBallX : Math.min(Math.max(0, wParams.x), screenWidth - ballSize);
        final int restoreY = (savedBallY >= 0) ? savedBallY : wParams.y;
        savedBallX = -1;
        savedBallY = -1;

        mainHandler.postDelayed(() -> {
            if (rootView == null) return;
            wParams.flags  = collapsedFlags();
            wParams.width  = ballSize;
            wParams.height = ballSize;
            wParams.x      = restoreX;   // restore exact pre-expand position
            wParams.y      = restoreY;
            try { windowManager.updateViewLayout(rootView, wParams); } catch (Exception ignored) {}
        }, 120);
    }

    // ── Hide / stop ───────────────────────────────────────────────────────────

    private void hideBubble() {
        if (rootView == null) return;

        // Cancel any pending expand runnable first — otherwise it can fire
        // after showBubble() recreates the view and cause a phantom re-expand.
        if (pendingExpand != null) {
            mainHandler.removeCallbacks(pendingExpand);
            pendingExpand = null;
        }
        savedBallX = -1;
        savedBallY = -1;

        try { windowManager.removeView(rootView); } catch (Exception ignored) {}
        rootView   = null;
        isExpanded = false;
        pageLoaded = false;

        // Explicitly destroy the WebView so it releases its renderer process,
        // native memory, and JS engine. Without this, repeated HIDE→START cycles
        // (now long-lived since we never call stopSelf()) would accumulate stale
        // WebView instances and their associated memory overhead.
        if (bubbleWebView != null) {
            try {
                bubbleWebView.stopLoading();
                bubbleWebView.loadUrl("about:blank");
                bubbleWebView.destroy();
            } catch (Exception ignored) {}
            bubbleWebView = null;
        }
    }

    // ── Fill-mode helpers ─────────────────────────────────────────────────────

    /**
     * Toggle FLAG_NOT_FOCUSABLE on the overlay window WITHOUT any visual size change.
     *
     * When filling=true  → overlay releases keyboard focus so the target app's
     *                       EditText keeps input focus for AccessibilityService scans.
     * When filling=false → restore the correct flags for the current expanded/collapsed
     *                       state so the bubble works normally again.
     *
     * Must be called on the main thread.
     */
    private void setFillMode(boolean filling) {
        if (rootView == null || wParams == null) return;
        try {
            if (filling) {
                wParams.flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            } else {
                wParams.flags = isExpanded ? expandedFlags() : collapsedFlags();
            }
            windowManager.updateViewLayout(rootView, wParams);
        } catch (Exception ignored) {}
    }

    /** Write text to clipboard and show an overlay toast explaining what happened. */
    private void fillClipboardFallback(String text) {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("xenox", text));
        } catch (Exception ignored) {}
        showOverlayToast("📋 Copied — manually paste করুন");
    }

    // ── Overlay toast ─────────────────────────────────────────────────────────

    private void showOverlayToast(String msg) {
        try {
            TextView tv = new TextView(this);
            tv.setText(msg);
            tv.setTextColor(0xFFC4B5FD);
            tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            tv.setTypeface(Typeface.DEFAULT_BOLD);
            tv.setSingleLine(false);
            tv.setMaxLines(2);

            FrameLayout fl = new FrameLayout(this);
            int padH = dpToPx(14), padV = dpToPx(9);
            fl.setPadding(padH, padV, padH, padV);
            fl.addView(tv);

            GradientDrawable bg = new GradientDrawable();
            bg.setColor(0xF2060612);
            bg.setCornerRadius(dpToPx(14));
            bg.setStroke(dpToPx(1), 0x997C3AED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) fl.setElevation(dpToPx(8));
            fl.setBackground(bg);

            int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

            WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT
            );
            p.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            p.y = dpToPx(48);

            windowManager.addView(fl, p);
            mainHandler.postDelayed(() -> {
                try { windowManager.removeView(fl); } catch (Exception ignored) {}
            }, 2800);
        } catch (Exception ignored) {}
    }

    // ── Notification helpers ──────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // IMPORTANCE_MIN previously used here made this foreground service look
            // "unimportant" to OEM task/battery managers (MIUI/ColorOS/FuntouchOS
            // especially), which made them much more willing to kill the process
            // while the bubble was hidden — confirmed by on-device diagnostic logs
            // showing the process pid changing (i.e. being killed and restarted)
            // right after a HIDE→re-START cycle, after which the Accessibility
            // Service never reconnected. IMPORTANCE_LOW keeps the notification
            // silent and unobtrusive (no sound, no badge, no heads-up popup) while
            // still signaling to the OS that this is an active, ongoing service.
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "HBX Short Bubble", NotificationManager.IMPORTANCE_LOW);
            ch.setSound(null, null);
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Intent i = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HBX Short")
            .setContentText("Float bubble চলছে")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pi)
            // See createNotificationChannel() — raised from PRIORITY_MIN to LOW for
            // the same reason. Still silent, still low-visual-priority to the user.
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .build();
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    // ── Accessibility-down recovery notification ────────────────────────────────

    private static final String A11Y_DOWN_CHANNEL_ID = "hbx_a11y_down";
    private static final int A11Y_DOWN_NOTIF_ID = 9911;
    private static volatile long lastA11yDownNotifyAt = 0;

    /**
     * Shows a one-time (rate-limited) high-visibility notification telling the user
     * auto-fill stopped working and linking straight to the Accessibility settings
     * screen, so they don't have to figure out on their own that a manual re-toggle
     * is needed. Rate-limited to once per 5 minutes so a burst of fill attempts
     * doesn't spam the notification tray.
     */
    private void maybeNotifyAccessibilityDown() {
        long now = System.currentTimeMillis();
        if (now - lastA11yDownNotifyAt < 5 * 60 * 1000L) return;
        lastA11yDownNotifyAt = now;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                    A11Y_DOWN_CHANNEL_ID, "Auto-fill issue", NotificationManager.IMPORTANCE_HIGH);
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) nm.createNotificationChannel(ch);
            }
            Intent settingsIntent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent pi = PendingIntent.getActivity(this, 1, settingsIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new NotificationCompat.Builder(this, A11Y_DOWN_CHANNEL_ID)
                .setContentTitle("Auto-fill বন্ধ হয়ে গেছে")
                .setContentText("Accessibility service অফ হয়ে গেছে — ঠিক করতে ট্যাপ করুন")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build();
            NotificationManagerCompat.from(this).notify(A11Y_DOWN_NOTIF_ID, n);
        } catch (Exception ignored) {}
    }

    // ── JavaScript Bridge ─────────────────────────────────────────────────────

    public class BubbleBridge {

        @JavascriptInterface
        public String readClipboard() {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm == null || !cm.hasPrimaryClip()) return "";
                ClipData.Item item = cm.getPrimaryClip().getItemAt(0);
                CharSequence t = item.getText();
                return t != null ? t.toString() : "";
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void writeClipboard(String text) {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("xenox", text));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void expand() {
            mainHandler.post(() -> expandBubble());
        }

        @JavascriptInterface
        public void collapse() {
            mainHandler.post(() -> collapseBubble());
        }

        @JavascriptInterface
        public void stopBubble() {
            // Only hide the overlay UI — do NOT stopSelf(). Keeping the service
            // (and process) alive prevents the AccessibilityService rebind
            // flakiness that happens after a process restart. See the "HIDE"
            // action comment in onStartCommand() for the full explanation.
            // NOTE: this class is a non-static inner class of BubbleService, so
            // `this::hideBubble` would resolve against BubbleBridge (which has
            // no such method) — must qualify with BubbleService.this.
            mainHandler.post(BubbleService.this::hideBubble);
        }

        @JavascriptInterface
        public String loadConfig() {
            return getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                .getString("float_config", "{}");
        }

        // Lock object for all read-modify-write ops on local_sheet_data SharedPreferences
        private final Object sheetLock = new Object();

        @JavascriptInterface
        public String appendLocalSheet(String col, String text) {
            synchronized (sheetLock) {
                try {
                    SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE);
                    String raw  = prefs.getString("local_sheet_data", "{}");
                    JSONObject data = new JSONObject(raw);
                    JSONArray  arr  = data.optJSONArray(col);
                    if (arr == null) arr = new JSONArray();
                    arr.put(text.length() > 400 ? text.substring(0, 400) : text);
                    data.put(col, arr);
                    prefs.edit().putString("local_sheet_data", data.toString()).apply();
                    return String.valueOf(arr.length());
                } catch (Exception e) { return "0"; }
            }
        }

        @JavascriptInterface
        public String deleteLocalSheet(String col) {
            synchronized (sheetLock) {
                try {
                    SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE);
                    String raw  = prefs.getString("local_sheet_data", "{}");
                    JSONObject data = new JSONObject(raw);
                    JSONArray  arr  = data.optJSONArray(col);
                    if (arr != null && arr.length() > 0) {
                        JSONArray newArr = new JSONArray();
                        for (int i = 0; i < arr.length() - 1; i++) newArr.put(arr.get(i));
                        if (newArr.length() == 0) data.remove(col);
                        else data.put(col, newArr);
                        prefs.edit().putString("local_sheet_data", data.toString()).apply();
                        return String.valueOf(newArr.length());
                    }
                    return "0";
                } catch (Exception e) { return "0"; }
            }
        }

        /** Read local sheet data as JSON string — used by localSheet.ts getLocalSheetData() */
        @JavascriptInterface
        public String getLocalSheetData() {
            synchronized (sheetLock) {
                return getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                    .getString("local_sheet_data", "{}");
            }
        }

        /** Save local sheet data from web JS — used by localSheet.ts saveLocalSheetData() */
        @JavascriptInterface
        public void saveLocalSheetData(String json) {
            synchronized (sheetLock) {
                try {
                    getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString("local_sheet_data", json).apply();
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public boolean isAccessibilityEnabled() {
            return XenoxAccessibilityService.isRunning();
        }

        @JavascriptInterface
        public String fillField(String fieldType, String text) {
            // fieldType: "username" or "password"
            //
            // FIX — two bugs addressed here:
            //
            // BUG 1 (Stop → Start breaks paste):
            //   After BubbleService.stopSelf() the process can be killed by Android.
            //   On the next Start the AccessibilityService instance is null until the OS
            //   reconnects it (onServiceConnected). We retry up to ~2.4 s instead of
            //   failing immediately.
            //
            // BUG 2 (shrink/expand glitch on ♻/🗝 tap):
            //   The previous fix called collapseBubble() which caused the bubble to visually
            //   shrink and then re-expand (the window resize triggered a phantom tap on the
            //   DragInterceptLayout). Fix: set FLAG_NOT_FOCUSABLE without any size change so
            //   the overlay releases keyboard focus (letting the target app's field stay
            //   focused) without any visual animation.
            //
            // This method spawns a background thread and returns "ok" immediately.
            // The JavascriptInterface thread is already a background thread, so Thread.sleep
            // inside the spawned thread is safe.

            final boolean isUsername = "username".equals(fieldType);
            final boolean isPassword = "password".equals(fieldType);
            if (!isUsername && !isPassword) return "fallback";

            new Thread(() -> {

                // ── Step 1: Release bubble keyboard focus so target field regains it ──
                //
                // When the bubble is expanded it holds keyboard/input focus. That means
                // findFocusedNode() returns null for the Instagram/Chrome field even though
                // the field is visible. Setting FLAG_NOT_FOCUSABLE (via setFillMode) makes
                // the overlay window non-focusable without any visual change — the underlying
                // field naturally regains FOCUS_INPUT so we can detect and fill it directly.
                mainHandler.post(() -> setFillMode(true));
                try { Thread.sleep(180); } catch (InterruptedException ignored0) {}

                // ── Step 2: Wait for AccessibilityService and fill ───────────────────
                String result = "svc_unavailable";
                for (int attempt = 0; attempt <= 50; attempt++) {
                    if (XenoxAccessibilityService.isRunning()) {
                        // Re-assert FLAG_RETRIEVE_INTERACTIVE_WINDOWS before scanning — without
                        // it getWindows() only returns the foreground window, so Instagram/Chrome
                        // fields become invisible to the BFS scan. refreshFlags() is internally
                        // throttled INSIDE XenoxAccessibilityService (single global throttle
                        // shared with the periodic re-assertion and onServiceConnected), so it
                        // is always safe to call here without a local guard — a second, separate
                        // throttle here would not protect against the periodic timer firing in
                        // the same window, which is what let the "malfunctioning" watchdog trip.
                        XenoxAccessibilityService.refreshFlags();

                        try {
                            result = isUsername
                                ? XenoxAccessibilityService.fillUsername(text)
                                : XenoxAccessibilityService.fillPassword(text);

                            // Retry once if no field found — window list may not be fully
                            // populated 250 ms after setFillMode / refreshFlags.
                            if ("no_field".equals(result)) {
                                try { Thread.sleep(400); } catch (InterruptedException ignored4) {}
                                result = isUsername
                                    ? XenoxAccessibilityService.fillUsername(text)
                                    : XenoxAccessibilityService.fillPassword(text);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "fillField: fill call threw (attempt=" + attempt + ")", e);
                            DiagLogger.error(BubbleService.this, TAG, "fillField: fill call threw (attempt=" + attempt + "): " + e, e);
                            result = "fallback";
                        }
                        Log.i(TAG, "fillField: attempt=" + attempt + " fieldType=" + fieldType + " result=" + result);
                        DiagLogger.log(BubbleService.this, TAG, "fillField: attempt=" + attempt + " fieldType=" + fieldType + " result=" + result);
                        break; // got a definitive result — stop retrying
                    }

                    // Service not yet available — retry silently.
                    try { Thread.sleep(200); } catch (InterruptedException ignored2) {}
                }
                if ("svc_unavailable".equals(result)) {
                    Log.w(TAG, "fillField: gave up after 50 attempts (~10s) — accessibility service never became available");
                    DiagLogger.warn(BubbleService.this, TAG, "fillField: gave up after 50 attempts (~10s) — accessibility service never became available");
                    // Real root cause (confirmed from on-device diagnostic logs): some OEMs
                    // (MIUI/ColorOS/FuntouchOS especially) kill this process while the bubble
                    // is hidden despite it being a foreground service, and afterwards the OS
                    // does not reliably rebind the AccessibilityService on its own — it stays
                    // unavailable until the user manually re-toggles it in Settings. There is
                    // no public API to force a rebind, so surface a one-time actionable
                    // notification instead of failing silently forever.
                    maybeNotifyAccessibilityDown();
                }

                // ── Step 3: Restore flags and report result ───────────────────────────
                final String finalResult = result;
                mainHandler.post(() -> {
                    setFillMode(false); // always restore correct overlay flags after fill
                    if ("no_field".equals(finalResult)) {
                        showOverlayToast("⚠️ কোনো input field পাওয়া যায়নি");
                    } else if ("fallback".equals(finalResult) || "svc_unavailable".equals(finalResult)) {
                        fillClipboardFallback(text);
                    }
                    // "ok" = auto-inserted — no extra toast needed
                });
            }).start();

            return "ok"; // returns immediately; fill is async on background thread
        }

        @JavascriptInterface
        public void pasteToFocused(String text) {
            // 1. Write to clipboard
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("xenox", text));
            } catch (Exception ignored) {}
            // 2. Collapse bubble so underlying app regains focus, then paste
            mainHandler.postDelayed(() -> {
                collapseBubble();
                mainHandler.postDelayed(() -> {
                    try {
                        InputMethodManager imm = (InputMethodManager)
                            getSystemService(Context.INPUT_METHOD_SERVICE);
                        if (imm != null) {
                            // performContextMenuAction is @hide in API 34 stubs — use reflection
                            java.lang.reflect.Method m = imm.getClass()
                                .getMethod("performContextMenuAction", int.class);
                            m.invoke(imm, android.R.id.paste);
                        }
                    } catch (Exception ignored2) {}
                }, 180);
            }, 60);
        }

        @JavascriptInterface
        public void showOverlay(String msg) {
            mainHandler.post(() -> showOverlayToast(msg));
        }

    }

    // ── Bubble HTML ───────────────────────────────────────────────────────────

    private String buildBubbleHtml() {
        final String bpx = ballSize + "px";

        return "<!DOCTYPE html><html><head>" +
            "<meta charset='UTF-8'>" +
            "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'>" +
            "<style>" +
            "*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}" +
            "html,body{background:transparent;overflow:hidden;width:100%;height:100%;touch-action:none;}" +

            // ── Ball (collapsed icon) ─────────────────────────────────────────
            // Explicit pixel size so circle stays round during window resize
            "#ball{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}" +
            // Simple circle matching the web-app preview style exactly
            "#bi{" +
              "border-radius:50%;" +
              "background:#0a0a0a;" +
              "border:2px solid rgba(139,92,246,.55);" +
              "width:" + bpx + ";height:" + bpx + ";" +
              "flex-shrink:0;" +
              "display:flex;align-items:center;justify-content:center;" +
              "overflow:hidden;}" +
            // Plain purple bolt — no glow filter, matches web-app preview
            "#bsvg{" +
              "width:48%;height:48%;}" +

            // ── Column (expanded panel) ───────────────────────────────────────
            "#col{position:absolute;top:0;left:0;right:0;bottom:0;display:none;flex-direction:column;" +
              "align-items:center;justify-content:space-evenly;padding:6px 0;touch-action:none;}" +
            ".btn{border-radius:50%;display:flex;flex-direction:column;align-items:center;" +
              "justify-content:center;cursor:pointer;color:#fff;flex-shrink:0;" +
              "user-select:none;-webkit-user-select:none;touch-action:none;transition:transform .07s;}" +
            ".btn:active,.btn.pressing{transform:scale(0.85);}" +
            // Yin-yang button — dark monochrome
            ".tbtn{background:#111118;border:1.5px solid rgba(255,255,255,.15);" +
              "box-shadow:0 2px 10px rgba(0,0,0,.7);}" +
            // Minus/stop button — dark red (still distinct so user knows it closes)
            ".sbtn{background:#2a0808;border:1.5px solid rgba(180,40,40,.5);" +
              "box-shadow:0 0 10px rgba(180,40,40,.3),0 2px 8px rgba(0,0,0,.7);}" +
            // Column buttons — dark monochrome (no bright colors)
            ".cbtn{background:#111118;border:1.5px solid rgba(255,255,255,.12);" +
              "box-shadow:0 2px 6px rgba(0,0,0,.6);}" +
            ".bcnt{display:block;opacity:.65;font-weight:700;line-height:1;margin-top:2px;}" +
            // Auto Username button — amber glow
            ".ubtn{background:rgba(17,20,14,.95);border:1.5px solid rgba(245,158,11,.45);" +
              "box-shadow:0 0 10px rgba(245,158,11,.25),0 3px 8px rgba(0,0,0,.6);}" +
            // Auto Password button — purple glow
            ".pbtn{background:rgba(14,10,28,.95);border:1.5px solid rgba(139,92,246,.45);" +
              "box-shadow:0 0 10px rgba(139,92,246,.25),0 3px 8px rgba(0,0,0,.6);}" +

            // ── In-bubble toast ───────────────────────────────────────────────
            "#tst{position:fixed;bottom:6px;left:0;right:0;display:flex;align-items:center;" +
              "justify-content:center;pointer-events:none;opacity:0;transition:opacity .2s;z-index:9999;}" +
            "#ti{background:rgba(4,4,16,.95);border:1px solid rgba(139,92,246,.5);color:#c4b5fd;" +
              "padding:5px 12px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;" +
              "max-width:92%;overflow:hidden;text-overflow:ellipsis;}" +
            "</style></head><body>" +

            // ── Ball DOM — inline SVG lightning bolt ──────────────────────────
            "<div id='ball'><div id='bi'>" +
              "<svg id='bsvg' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
                "<path d='M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z' fill='#8b5cf6'/>" +
              "</svg>" +
            "</div></div>" +

            // ── Column DOM ────────────────────────────────────────────────────
            "<div id='col'>" +
              "<div class='btn tbtn' id='tbtn'><span id='tspn'>&#9775;</span></div>" +
              "<div id='cbs' style='display:contents;'></div>" +
              "<div class='btn sbtn' id='sbtn'><span>&#8722;</span></div>" +
            "</div>" +

            "<div id='tst'><div id='ti'></div></div>" +

            "<script>" +
            "var RK='xenox_col_rows';" +
            "var LD={};" +

            "function gc(){try{var s=XenoxAndroid.loadConfig();return JSON.parse(s||'null');}catch(e){return null;}}" +
            "function gr(){try{return JSON.parse(localStorage.getItem(RK)||'{}');}catch(e){return {};}}" +
            "function wr(r){localStorage.setItem(RK,JSON.stringify(r));}" +
            "function pc(c){if(!c||!c.columns)return['A','B','C'];" +
              "return c.columns.split(',').map(function(x){return x.trim().toUpperCase();}).filter(Boolean).slice(0,8);}" +
            "function bs(c){return c&&c.buttonSize?Math.max(32,Math.min(80,c.buttonSize)):52;}" +

            "function isOn(v){return v===true||v==='true';}" +
            "function buildUI(){" +
              "var c=gc(),cs=pc(c),b=bs(c);" +
              // Bug 2 fix: read rs from localStorage; if empty (fresh WebView), seed from native data
              "var rs=gr();" +
              "if(!Object.keys(rs).length){" +
                "try{" +
                  "var _nd=JSON.parse(XenoxAndroid.getLocalSheetData()||'{}');" +
                  "var _nr={};" +
                  "Object.keys(_nd).forEach(function(k){var a=_nd[k];if(Array.isArray(a)&&a.length>0)_nr[k]={row:a.length,status:'ok'};});" +
                  "if(Object.keys(_nr).length>0){rs=_nr;wr(rs);}" +
                "}catch(_){}" +
              "}" +
              "var sz=b+'px';" +
              "var tb=document.getElementById('tbtn'),sp=document.getElementById('tspn');" +
              "tb.style.width=sz;tb.style.height=sz;" +
              "sp.style.fontSize=Math.round(b*.46)+'px';sp.style.fontFamily='serif';" +
              "var sb=document.getElementById('sbtn');" +
              "sb.style.width=sz;sb.style.height=sz;" +
              "sb.style.fontSize=Math.round(b*.44)+'px';" +
              "var el=document.getElementById('cbs');el.innerHTML='';" +
              // Auto feature flags
              "var auOn=c&&isOn(c.autoUsername)&&isOn(c.autoUsernameConfirmed)&&c.autoUsernameColumn;" +
              "var apOn=c&&isOn(c.autoPassword)&&c.autoPasswordValue&&c.autoPasswordColumn;" +
              // Bug 1 fix: single loop over cs — each column renders as ♻, 🗝, or normal based on column identity
              "cs.forEach(function(col){" +
                "if(auOn&&col===c.autoUsernameColumn){" +
                  "var auRn=(rs[col]&&rs[col].row)||0;" +
                  "var du=document.createElement('div');" +
                  "du.className='btn ubtn';du.id='cbAU';" +
                  "du.style.width=sz;du.style.height=sz;" +
                  "du.innerHTML=chSpec('\\u267b',auRn,b);" +
                  "var AUT=null,AUF=false;" +
                  "du.addEventListener('touchstart',function(e){e.preventDefault();du.classList.add('pressing');AUF=false;" +
                    "AUT=setTimeout(function(){AUF=true;du.classList.remove('pressing');doDelAutoUsername();},600);},false);" +
                  "du.addEventListener('touchend',function(e){e.preventDefault();du.classList.remove('pressing');" +
                    "if(AUT){clearTimeout(AUT);AUT=null;}if(!AUF)doAutoUsername();AUF=false;},false);" +
                  "du.addEventListener('touchcancel',function(){du.classList.remove('pressing');if(AUT){clearTimeout(AUT);AUT=null;}AUF=false;},false);" +
                  "el.appendChild(du);" +
                "}else if(apOn&&col===c.autoPasswordColumn){" +
                  "var apRn=(rs[col]&&rs[col].row)||0;" +
                  "var dp=document.createElement('div');" +
                  "dp.className='btn pbtn';dp.id='cbAP';" +
                  "dp.style.width=sz;dp.style.height=sz;" +
                  "dp.innerHTML=chSpec('\\uD83D\\uDDDD',apRn,b);" +
                  "var APT=null,APF=false;" +
                  "dp.addEventListener('touchstart',function(e){e.preventDefault();dp.classList.add('pressing');APF=false;" +
                    "APT=setTimeout(function(){APF=true;dp.classList.remove('pressing');doDelAutoPassword();},600);},false);" +
                  "dp.addEventListener('touchend',function(e){e.preventDefault();dp.classList.remove('pressing');" +
                    "if(APT){clearTimeout(APT);APT=null;}if(!APF)doAutoPassword();APF=false;},false);" +
                  "dp.addEventListener('touchcancel',function(){dp.classList.remove('pressing');if(APT){clearTimeout(APT);APT=null;}APF=false;},false);" +
                  "el.appendChild(dp);" +
                "}else{" +
                  "var rn=(rs[col]&&rs[col].row)||0;" +
                  "var d=document.createElement('div');" +
                  "d.className='btn cbtn';d.id='cb'+col;" +
                  "d.style.width=sz;d.style.height=sz;" +
                  "d.innerHTML=ch(col,rn,false,b);" +
                  "bindColBtn(d,col);" +
                  "el.appendChild(d);" +
                "}" +
              "});" +
            "}" +

            "function bindColBtn(d,col){" +
              "d.addEventListener('touchstart',function(e){e.preventDefault();d.classList.add('pressing');onD(col);},false);" +
              "d.addEventListener('touchend',function(e){e.preventDefault();d.classList.remove('pressing');onU(col);},false);" +
              "d.addEventListener('touchcancel',function(){d.classList.remove('pressing');onX();},false);" +
            "}" +

            "function ch(col,rn,ld,b){" +
              "if(ld)return '<span style=\"font-size:'+Math.round(b*.38)+'px\">&#128221;</span>';" +
              "var h='<span style=\"font-size:'+Math.round(b*.3)+'px;font-weight:900;display:block;line-height:1.1\">'+col+'</span>';" +
              "if(rn>0)h+='<span class=\"bcnt\" style=\"font-size:'+Math.max(8,Math.round(b*.17))+'px\">'+rn+'</span>';" +
              "return h;" +
            "}" +
            "function chSpec(emoji,rn,b){" +
              "var h='<span style=\"font-size:'+Math.round(b*.46)+'px;line-height:1;display:block\">'+emoji+'</span>';" +
              "if(rn>0)h+='<span class=\"bcnt\" style=\"font-size:'+Math.max(8,Math.round(b*.17))+'px\">'+rn+'</span>';" +
              "return h;" +
            "}" +
            "function upd(col,rn,ld){var c=gc();var el=document.getElementById('cb'+col);if(el)el.innerHTML=ch(col,rn,ld,bs(c));}" +
            "function updSpec(id,rn){var c=gc();var el=document.getElementById('cbA'+id);if(!el)return;" +
              "var b=bs(c);" +
              "el.innerHTML=chSpec(id==='U'?'\\u267b':'\\uD83D\\uDDDD',rn,b);" +
            "}" +

            // Long-press state machine
            "var LT=null,LC=null,LF=false;" +
            "function onD(col){LC=col;LF=false;LT=setTimeout(function(){LF=true;doDel(col);},600);}" +
            "function onU(col){if(LT){clearTimeout(LT);LT=null;}if(!LF&&LC===col)doSave(col);LC=null;}" +
            "function onX(){if(LT){clearTimeout(LT);LT=null;}LC=null;LF=false;}" +

            // Save (tap)
            "function doSave(col){" +
              "if(LD[col])return;" +
              "var c=gc(),txt='';" +
              "try{txt=(XenoxAndroid.readClipboard()||'').trim();}catch(e){}" +
              "if(!txt){toast('\\u26a0 Clipboard \\u0996\\u09BE\\u09B2\\u09BF \\u2014 copy \\u0995\\u09B0\\u09C1\\u09A8');return;}" +
              "LD[col]=true;upd(col,0,true);" +
              "var lc=c&&c.saveMode==='local';" +
              "if(lc){" +
                "try{" +
                  "var rn=parseInt(XenoxAndroid.appendLocalSheet(col,txt))||0;" +
                  "var rs=gr();rs[col]={row:rn,status:'ok'};wr(rs);" +
                  // Trigger React local-sheet page refresh immediately via storage event
                  "try{localStorage.setItem('xenox_local_sheet_data',XenoxAndroid.getLocalSheetData());}catch(_){}" +
                  "var msg='\\u2705 '+col+' \\u2192 row '+rn;" +
                  "toast(msg);" +
                  "try{XenoxAndroid.showOverlay(msg);}catch(e){}" +
                "}catch(e){toast('\\u274c '+String(e.message||e).slice(0,50));}" +
                "LD[col]=false;buildUI();" +
              "}else{" +
                "if(!c||!c.webAppUrl){toast('\\u274c Web App URL \\u09A8\\u09BE\\u0987');LD[col]=false;buildUI();return;}" +
                "var bd=JSON.stringify({sheetId:c.extractedSheetId||c.sheetLinkOrId||''," +
                  "sheetName:c.sheetName||'Sheet1',column:col,action:'APPEND',text:txt.slice(0,400)});" +
                "fetch(c.webAppUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:bd,redirect:'follow'})" +
                ".then(function(r){return r.text();})" +
                ".then(function(t){" +
                  "var j;try{j=JSON.parse(t);}catch(e){j={result:'success',savedRow:0};}" +
                  "if(j.result==='success'){" +
                    "var sr=j.savedRow||0;" +
                    "var rs2=gr();rs2[col]={row:sr,status:'ok'};wr(rs2);" +
                    "var msg2='\\u2705 '+col+' \\u2192 row '+sr;" +
                    "toast(msg2);" +
                    "try{XenoxAndroid.showOverlay(msg2);}catch(e){}" +
                  "}else toast('\\u274c '+(j.message||'failed'));" +
                  "LD[col]=false;buildUI();" +
                "})" +
                ".catch(function(e){toast('\\u274c '+String(e.message||e).slice(0,40));LD[col]=false;buildUI();});" +
              "}" +
            "}" +

            // Delete (long-press)
            "function doDel(col){" +
              "var c=gc(),b=bs(c);" +
              "var el=document.getElementById('cb'+col);" +
              "if(el)el.innerHTML='<span style=\"font-size:'+Math.round(b*.38)+'px\">&#128465;</span>';" +
              "var lc=c&&c.saveMode==='local';" +
              "if(lc){" +
                "try{" +
                  "var cnt=parseInt(XenoxAndroid.deleteLocalSheet(col))||0;" +
                  "var rs=gr();rs[col]={row:cnt,status:'ok'};wr(rs);" +
                  "try{localStorage.setItem('xenox_local_sheet_data',XenoxAndroid.getLocalSheetData());}catch(_){}" +
                  "var msg='\\uD83D\\uDDD1 '+col+' deleted';" +
                  "toast(msg);" +
                  "try{XenoxAndroid.showOverlay(msg);}catch(e){}" +
                "}catch(e){toast('\\u274c '+String(e.message||e).slice(0,50));}" +
                "setTimeout(buildUI,900);" +
              "}else{" +
                "if(!c||!c.webAppUrl){toast('\\u274c Web App URL \\u09A8\\u09BE\\u0987');setTimeout(buildUI,900);return;}" +
                "var bd2=JSON.stringify({sheetId:c.extractedSheetId||c.sheetLinkOrId||''," +
                  "sheetName:c.sheetName||'Sheet1',column:col,action:'DELETE'});" +
                "fetch(c.webAppUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:bd2,redirect:'follow'})" +
                ".then(function(r){return r.text();})" +
                ".then(function(t){" +
                  "var j;try{j=JSON.parse(t);}catch(e){j={result:'success',currentCount:0};}" +
                  "if(j.result==='success'){" +
                    "var c2=j.currentCount||0;var r2=gr();r2[col]={row:c2,status:'ok'};wr(r2);" +
                    "var msg3='\\uD83D\\uDDD1 '+col+' count: '+c2;" +
                    "toast(msg3);" +
                    "try{XenoxAndroid.showOverlay(msg3);}catch(e){}" +
                  "}else toast('\\u274c Delete failed');" +
                  "setTimeout(buildUI,900);" +
                "})" +
                ".catch(function(e){toast('\\u274c '+String(e.message||e).slice(0,40));setTimeout(buildUI,900);});" +
              "}" +
            "}" +

            // ── Auto Username generator ────────────────────────────────────
            "function generateUsername(){" +
              "function ri(n){" +
                "try{if(typeof crypto!=='undefined'&&crypto.getRandomValues){var a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n;}}catch(e){}" +
                "return Math.floor(Math.random()*n);" +
              "}" +
              "var V='aeiou',C='bcdfghjklmnprstvwxz';" +
              "function rc(s){return s[ri(s.length)];}" +
              "function mw(mn,mx){var l=mn+ri(mx-mn+1),w='',v=ri(2)===0;for(var i=0;i<l;i++){w+=v?rc(V):rc(C);v=!v;}return w;}" +
              "function md(mn,mx){var n=mn+ri(mx-mn+1),s='';for(var i=0;i<n;i++)s+=ri(10);return s;}" +
              "var pats=[" +
                "function(){return mw(4,5)+'_'+rc(C)+(1+ri(9))+'_'+md(2,3)+rc(C)+(1+ri(9))+'_'+md(3,4);}," +
                "function(){return mw(4,6)+'_'+rc(C)+(1+ri(9))+'_'+md(4,6);}," +
                "function(){return mw(5,6)+'_'+md(2,2)+rc(C)+(1+ri(9))+'_'+md(3,4);}," +
                "function(){return mw(4,5)+'_'+md(2,3)+rc(C)+rc(V)+(1+ri(9))+'_'+md(2,3);}," +
                "function(){return mw(4,5)+'_'+rc(C)+(1+ri(9))+'_'+mw(2,3)+md(2,4);}," +
                "function(){return mw(4,5)+(1+ri(9))+'_'+rc(C)+(1+ri(9))+'_'+md(3,5);}," +
                "function(){return md(2,2)+'_'+mw(4,6)+'_'+rc(C)+(1+ri(9))+md(2,3);}," +
                "function(){return mw(4,5)+'_'+mw(3,4)+'_'+md(4,6);}" +
              "];" +
              "var u=pats[ri(pats.length)]().toLowerCase().replace(/[^a-z0-9_]/g,'');" +
              "while(u.length<12)u+=ri(10);" +
              "if(u.length>20)u=u.slice(0,20);" +
              "return u;" +
            "}" +

            "function doAutoUsername(){" +
              "var c=gc();" +
              "var col=c&&c.autoUsernameColumn;" +
              "if(!col){toast('\\u26a0 Username column \\u09B8\\u09C7\\u099F \\u09A8\\u09BE\\u0987');return;}" +
              "var uname=generateUsername();" +
              // Write to clipboard immediately so user always has the value regardless of fill outcome.
              // fillField() is async and always returns 'ok' from JS side, so we cannot rely on
              // its return value — instead we write clipboard first as guaranteed fallback, then
              // attempt auto-insert in the background.
              "try{XenoxAndroid.writeClipboard(uname);}catch(e){}" +
              "try{XenoxAndroid.fillField('username',uname);}catch(e){}" +
              "toast('\\u267b '+uname+' \\u2713');" +
              "try{XenoxAndroid.showOverlay('\\u267b '+uname);}catch(e){}" +
              // Save to sheet
              "var lc=c&&c.saveMode==='local';" +
              "if(lc){" +
                "try{" +
                  "var rn=parseInt(XenoxAndroid.appendLocalSheet(col,uname))||0;" +
                  "var rs=gr();rs[col]={row:rn,status:'ok'};wr(rs);" +
                  "try{localStorage.setItem('xenox_local_sheet_data',XenoxAndroid.getLocalSheetData());}catch(_){}" +
                  "updSpec('U',rn);" +
                "}catch(e){}" +
              "}else if(c&&c.webAppUrl){" +
                "var bd=JSON.stringify({sheetId:c.extractedSheetId||c.sheetLinkOrId||''," +
                  "sheetName:c.sheetName||'Sheet1',column:col,action:'APPEND',text:uname});" +
                "fetch(c.webAppUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:bd,redirect:'follow'})" +
                ".then(function(r){return r.text();})" +
                ".then(function(t){var j;try{j=JSON.parse(t);}catch(e){j={result:'success',savedRow:0};}" +
                  "if(j.result==='success'){var rs2=gr();rs2[col]={row:j.savedRow||0,status:'ok'};wr(rs2);" +
                  "updSpec('U',j.savedRow||0);}" +
                "}).catch(function(){});" +
              "}" +
            "}" +

            "function doDelAutoUsername(){" +
              "var c=gc();var col=c&&c.autoUsernameColumn;" +
              "if(!col){toast('\\u26a0 Column set nei');return;}" +
              "var lc=c&&c.saveMode==='local';" +
              "if(lc){" +
                "try{" +
                  "var cnt=parseInt(XenoxAndroid.deleteLocalSheet(col))||0;" +
                  "var rs=gr();rs[col]={row:cnt,status:'ok'};wr(rs);" +
                  "try{localStorage.setItem('xenox_local_sheet_data',XenoxAndroid.getLocalSheetData());}catch(_){}" +
                  "updSpec('U',cnt);" +
                  "toast('\\uD83D\\uDDD1 \\u267b \\u09AE\\u09CB\\u099B\\u09BE \\u2014 row '+cnt);" +
                  "try{XenoxAndroid.showOverlay('\\uD83D\\uDDD1 \\u267b \\u09AE\\u09CB\\u099B\\u09BE');}catch(e){}" +
                "}catch(e){}" +
              "}else if(c&&c.webAppUrl){" +
                "var bd=JSON.stringify({sheetId:c.extractedSheetId||c.sheetLinkOrId||''," +
                  "sheetName:c.sheetName||'Sheet1',column:col,action:'DELETE'});" +
                "fetch(c.webAppUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:bd,redirect:'follow'})" +
                ".then(function(r){return r.text();})" +
                ".then(function(t){var j;try{j=JSON.parse(t);}catch(e){j={result:'success',savedRow:0};}" +
                  "var cnt2=(j.savedRow||0);var rs2=gr();rs2[col]={row:cnt2,status:'ok'};wr(rs2);" +
                  "updSpec('U',cnt2);" +
                  "toast('\\uD83D\\uDDD1 \\u267b \\u09AE\\u09CB\\u099B\\u09BE \\u2014 row '+cnt2);" +
                "}).catch(function(){toast('\\u274c Delete failed');});" +
              "}" +
            "}" +

            // ── Auto Password paste ────────────────────────────────────────
            "function doAutoPassword(){" +
              "var c=gc();" +
              "var col=c&&c.autoPasswordColumn;" +
              "var pwd=c&&c.autoPasswordValue;" +
              "if(!col||!pwd){toast('\\u26a0 Password/column \\u09B8\\u09C7\\u099F \\u09A8\\u09BE\\u0987');return;}" +
              // Same as username: write clipboard first, then attempt auto-insert in background.
              "try{XenoxAndroid.writeClipboard(pwd);}catch(e){}" +
              "try{XenoxAndroid.fillField('password',pwd);}catch(e){}" +
              "toast('\\uD83D\\uDDDD \\u2713 Clipboard + Auto');" +
              "try{XenoxAndroid.showOverlay('\\uD83D\\uDDDD Password');}catch(e){}" +
              // Save to sheet
              "var lc2=c&&c.saveMode==='local';" +
              "if(lc2){" +
                "try{" +
                  "var rn2=parseInt(XenoxAndroid.appendLocalSheet(col,pwd))||0;" +
                  "var rs3=gr();rs3[col]={row:rn2,status:'ok'};wr(rs3);" +
                  "try{localStorage.setItem('xenox_local_sheet_data',XenoxAndroid.getLocalSheetData());}catch(_){}" +
                  "updSpec('P',rn2);" +
                "}catch(e){}" +
              "}else if(c&&c.webAppUrl){" +
                "var bd3=JSON.stringify({sheetId:c.extractedSheetId||c.sheetLinkOrId||''," +
                  "sheetName:c.sheetName||'Sheet1',column:col,action:'APPEND',text:pwd});" +
                "fetch(c.webAppUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:bd3,redirect:'follow'})" +
                ".then(function(r){return r.text();})" +
                ".then(function(t){var j;try{j=JSON.parse(t);}catch(e){j={result:'success',savedRow:0};}" +
                  "if(j.result==='success'){var rs4=gr();rs4[col]={row:j.savedRow||0,status:'ok'};wr(rs4);" +
                  "updSpec('P',j.savedRow||0);}" +
                "}).catch(function(){});" +
              "}" +
            "}" +

            "function doDelAutoPassword(){" +
              "var c=gc();var col=c&&c.autoPasswordColumn;" +
              "if(!col){toast('\\u26a0 Column set nei');return;}" +
              "var lc=c&&c.saveMode==='local';" +
              "if(lc){" +
                "try{" +
                  "var cnt=parseInt(XenoxAndroid.deleteLocalSheet(col))||0;" +
                  "var rs=gr();rs[col]={row:cnt,status:'ok'};wr(rs);" +
                  "try{localStorage.setItem('xenox_local_sheet_data',XenoxAndroid.getLocalSheetData());}catch(_){}" +
                  "updSpec('P',cnt);" +
                  "toast('\\uD83D\\uDDD1 \\uD83D\\uDDDD \\u09AE\\u09CB\\u099B\\u09BE \\u2014 row '+cnt);" +
                  "try{XenoxAndroid.showOverlay('\\uD83D\\uDDD1 \\uD83D\\uDDDD \\u09AE\\u09CB\\u099B\\u09BE');}catch(e){}" +
                "}catch(e){}" +
              "}else if(c&&c.webAppUrl){" +
                "var bd=JSON.stringify({sheetId:c.extractedSheetId||c.sheetLinkOrId||''," +
                  "sheetName:c.sheetName||'Sheet1',column:col,action:'DELETE'});" +
                "fetch(c.webAppUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:bd,redirect:'follow'})" +
                ".then(function(r){return r.text();})" +
                ".then(function(t){var j;try{j=JSON.parse(t);}catch(e){j={result:'success',savedRow:0};}" +
                  "var cnt2=(j.savedRow||0);var rs2=gr();rs2[col]={row:cnt2,status:'ok'};wr(rs2);" +
                  "updSpec('P',cnt2);" +
                  "toast('\\uD83D\\uDDD1 \\uD83D\\uDDDD \\u09AE\\u09CB\\u099B\\u09BE \\u2014 row '+cnt2);" +
                "}).catch(function(){toast('\\u274c Delete failed');});" +
              "}" +
            "}" +

            // 2FA generator
            "async function do2FA(){" +
              "var s='';" +
              "try{var cfg=gc();if(cfg&&cfg.twoFaSecret)s=cfg.twoFaSecret.trim();}catch(e){}" +
              "if(!s){try{s=(XenoxAndroid.readClipboard()||'').trim();}catch(e){}}" +
              "if(!s){toast('\\u26a0 2FA secret copy \\u0995\\u09B0\\u09C1\\u09A8, \\u09A4\\u09BE\\u09B0\\u09AA\\u09B0 \\u2623 \\u099A\\u09BE\\u09AA\\u09C1\\u09A8');return;}" +
              "try{" +
                "var clean=s.replace(/\\s+/g,'').toUpperCase().replace(/=+$/,'');" +
                "var alpha='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',bits=0,val=0,bytes=[];" +
                "for(var xc of clean){var xi=alpha.indexOf(xc);if(xi<0)continue;" +
                  "val=(val<<5)|xi;bits+=5;if(bits>=8){bytes.push((val>>>(bits-8))&0xff);bits-=8;}}" +
                "var key=await crypto.subtle.importKey('raw',new Uint8Array(bytes),{name:'HMAC',hash:'SHA-1'},false,['sign']);" +
                "var ctr=Math.floor(Date.now()/1000/30);" +
                "var buf=new ArrayBuffer(8);var dv=new DataView(buf);" +
                "dv.setUint32(0,Math.floor(ctr/0x100000000),false);dv.setUint32(4,ctr>>>0,false);" +
                "var sig=await crypto.subtle.sign('HMAC',key,buf);var hsh=new Uint8Array(sig);" +
                "var off=hsh[hsh.length-1]&0x0f;" +
                "var code=((hsh[off]&0x7f)<<24)|(hsh[off+1]<<16)|(hsh[off+2]<<8)|hsh[off+3];" +
                "var otp=(code%1000000).toString().padStart(6,'0');" +
                "try{XenoxAndroid.writeClipboard(otp);}catch(e){}" +
                "var msg2fa='\\u2705 2FA = '+otp;" +
                "toast(msg2fa);" +
                "try{XenoxAndroid.showOverlay(msg2fa);}catch(e){}" +
              "}catch(e){toast('\\u274c Invalid 2FA secret key');}" +
            "}" +

            // In-bubble toast
            "var TT=null;" +
            "function toast(msg){" +
              "var el=document.getElementById('tst'),ti=document.getElementById('ti');" +
              "if(!el||!ti)return;ti.textContent=msg;el.style.opacity='1';" +
              "if(TT)clearTimeout(TT);TT=setTimeout(function(){el.style.opacity='0';},3000);" +
            "}" +

            // Stop button: short-tap = collapse, long-press = stop service
            "var ST=null,SF=false;" +
            "document.getElementById('sbtn').addEventListener('touchstart',function(e){" +
              "e.preventDefault();SF=false;" +
              "ST=setTimeout(function(){SF=true;try{XenoxAndroid.stopBubble();}catch(e){}},600);" +
            "},false);" +
            "document.getElementById('sbtn').addEventListener('touchend',function(e){" +
              "e.preventDefault();" +
              "if(ST){clearTimeout(ST);ST=null;}" +
              "if(!SF)try{XenoxAndroid.collapse();}catch(e){}" +
              "SF=false;" +
            "},false);" +

            // 2FA button
            "document.getElementById('tbtn').addEventListener('touchstart',function(e){e.preventDefault();},false);" +
            "document.getElementById('tbtn').addEventListener('touchend',function(e){e.preventDefault();do2FA();},false);" +

            // Java calls this to toggle view
            "window.xenoxExpand=function(show){" +
              "document.getElementById('ball').style.display=show?'none':'flex';" +
              "document.getElementById('col').style.display=show?'flex':'none';" +
              "if(show)setTimeout(buildUI,30);" +
            "};" +
            "</script></body></html>";
    }
}
