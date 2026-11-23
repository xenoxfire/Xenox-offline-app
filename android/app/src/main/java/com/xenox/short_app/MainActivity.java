package com.xenox.short_app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "XenoxShort";
    private static final int OVERLAY_PERMISSION_CODE = 1001;
    private static final int FILE_CHOOSER_CODE = 1002;
    private static final int SMS_PERMISSION_CODE = 1003;
    private static final int NOTIF_PERMISSION_CODE = 1004;

    static final String SERVER_URL = "https://web-production-cec52.up.railway.app";
    static final String PREFS_NAME = "xenox_prefs";

    WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;

    // Platform WebView (Instagram / Facebook) embedded below the React top bar
    private FrameLayout mainFrame;
    private WebView platformWebView;
    private String platformCurrentUrl = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        setupWebView();
        requestPermissions();

        showSplashThenLoad();
    }

    // First-launch only: ask the user to enable the OEM's "Autostart"/"Protected
    // apps" permission, like a normal permission prompt. There is no public API
    // to grant this for the user — tapping Allow just deep-links into the OEM's
    // own settings screen where the user flips it on manually. Shown once ever.
    private void maybePromptAutostart() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (prefs.getBoolean("autostart_prompt_shown", false)) return;
            prefs.edit().putBoolean("autostart_prompt_shown", true).apply();

            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (isFinishing() || isDestroyed()) return;
                new androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle("Allow Autostart")
                    .setMessage("To keep Auto Paste working reliably in the background, allow this app to run in Autostart / Protected apps.")
                    .setCancelable(false)
                    .setPositiveButton("Allow", (d, w) -> new XenoxBridge(this).openAutostartSettings())
                    .setNegativeButton("Not now", (d, w) -> d.dismiss())
                    .show();
            }, 3500);
        } catch (Exception e) {
            Log.w(TAG, "maybePromptAutostart failed", e);
        }
    }

    // Ask the OEM to stop killing our background process so FCM push notifications
    // keep arriving reliably (Facebook/WhatsApp/Telegram-style) even when the app
    // isn't open. Without this, many phones (Xiaomi/Vivo/Oppo/Samsung especially)
    // freeze or kill the app in the background and pushes silently stop arriving.
    private void requestIgnoreBatteryOptimizations() {
        try {
            String pkg = getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + pkg));
                startActivity(intent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not request battery optimization exemption", e);
        }
    }

    // ── Splash screen (2.5 s) then swap to WebView ───────────────────────────
    private void showSplashThenLoad() {
        float density = getResources().getDisplayMetrics().density;

        // Root dark frame
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(Color.parseColor("#0A0A0A"));

        // Centered vertical stack
        LinearLayout center = new LinearLayout(this);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER_HORIZONTAL);

        // Logo icon
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher_round);
        int iconPx = (int)(90 * density);
        LinearLayout.LayoutParams logolp = new LinearLayout.LayoutParams(iconPx, iconPx);
        logolp.gravity = Gravity.CENTER_HORIZONTAL;
        logo.setLayoutParams(logolp);

        // App name
        TextView name = new TextView(this);
        name.setText("Xeno HBX Short");
        name.setTextColor(Color.WHITE);
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        name.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams namelp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        namelp.topMargin = (int)(14 * density);
        namelp.gravity = Gravity.CENTER_HORIZONTAL;
        name.setLayoutParams(namelp);

        // Subtitle
        TextView sub = new TextView(this);
        sub.setText("Sheet Manager");
        sub.setTextColor(Color.parseColor("#6B7280"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f);
        sub.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sublp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        sublp.topMargin = (int)(5 * density);
        sublp.gravity = Gravity.CENTER_HORIZONTAL;
        sub.setLayoutParams(sublp);

        center.addView(logo);
        center.addView(name);
        center.addView(sub);

        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT);
        cp.gravity = Gravity.CENTER;
        splash.addView(center, cp);

        setContentView(splash);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            // Wrap webView in a FrameLayout so we can overlay the platform WebView later
            mainFrame = new FrameLayout(this);
            mainFrame.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
            setContentView(mainFrame);
            loadApp();
        }, 2500);
    }

    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setRenderPriority(WebSettings.RenderPriority.HIGH);
        s.setSupportMultipleWindows(true);
        // Reduce keyboard/scroll lag — pre-raster off-screen tiles on GPU
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            s.setOffscreenPreRaster(true);
        }

        // Real Chrome mobile UA — required so Instagram/Facebook don't block the WebView
        s.setUserAgentString("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36");

        webView.addJavascriptInterface(new XenoxBridge(this), "XenoxAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                // Let Instagram and Facebook load directly inside the WebView
                if (url.contains("instagram.com") || url.contains("facebook.com")) {
                    return false;
                }
                if (!url.startsWith(SERVER_URL) && !url.startsWith("file://") && !url.startsWith("about:")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript("window.__xenoxNativeReady = true;", null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                              FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = filePathCallback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_CODE);
                } catch (Exception e) {
                    fileChooserCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    // Offline build: no SMS / notification permission popups at launch.
    private void requestPermissions() {
        // intentionally empty
    }

    private void loadApp() {
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    // Remove and destroy the platform WebView; safe to call multiple times.
    void detachPlatformWebViewInternal() {
        if (platformWebView != null) {
            if (mainFrame != null) mainFrame.removeView(platformWebView);
            platformWebView.stopLoading();
            platformWebView.destroy();
            platformWebView = null;
        }
        platformCurrentUrl = "";
    }

    @Override
    public void onBackPressed() {
        // Platform WebView (Instagram/Facebook) gets first shot at back navigation
        if (platformWebView != null && platformWebView.canGoBack()) {
            platformWebView.goBack();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OVERLAY_PERMISSION_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new Event('xenox:overlay-granted'));", null);
            }
            return;
        }
        if (requestCode == FILE_CHOOSER_CODE) {
            if (fileChooserCallback != null) {
                Uri[] results = (resultCode == Activity.RESULT_OK && data != null)
                    ? new Uri[]{ data.getData() } : null;
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
        }
    }

    // ─── JavaScript Bridge ────────────────────────────────────────────────────
    public class XenoxBridge {
        private final Context ctx;
        private boolean bubbleRunning = false;

        XenoxBridge(Context context) { this.ctx = context; }

        @JavascriptInterface
        public void loadUrl(String url) {
            // Load a URL directly in the main WebView (used by CreateAcc to open
            // Instagram/Facebook without a proxy — Android back button goes back).
            if (url == null || url.isEmpty()) return;
            runOnUiThread(() -> webView.loadUrl(url));
        }

        @JavascriptInterface
        public boolean hasOverlayPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                return Settings.canDrawOverlays(ctx);
            return true;
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                startActivityForResult(
                    new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + ctx.getPackageName())),
                    OVERLAY_PERMISSION_CODE
                );
            }
        }

        @JavascriptInterface
        public boolean isAccessibilityEnabled() {
            return XenoxAccessibilityService.isRunning();
        }

        @JavascriptInterface
        public void openAccessibilitySettings() {
            try {
                startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            } catch (Exception e) {
                Log.e(TAG, "openAccessibilitySettings: " + e.getMessage());
            }
        }

        // Cached by the WebView every time it recomputes the user's real
        // subscription/lifetime status. XenoxFirebaseService reads this same
        // SharedPreferences key when a "premium_lock" push arrives — this is
        // what lets the device lock itself out immediately on Free Bonus
        // expiry even while the app/WebView is fully closed, without ever
        // touching Accessibility or Auto Paste.
        @JavascriptInterface
        public void setPremiumStatus(boolean active) {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean("subscription_active", active).apply();
        }

        @JavascriptInterface
        public boolean startBubble() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx))
                return false;
            try {
                Intent intent = new Intent(ctx, BubbleService.class);
                intent.setAction("START");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    ctx.startForegroundService(intent);
                else
                    ctx.startService(intent);
                bubbleRunning = true;
                return true;
            } catch (Exception e) {
                Log.e(TAG, "startBubble: " + e.getMessage());
                return false;
            }
        }

        @JavascriptInterface
        public void stopBubble() {
            // NOTE: we intentionally send a "HIDE" action instead of calling
            // ctx.stopService(). Fully stopping the service lets Android kill the
            // whole app process, and re-binding XenoxAccessibilityService after a
            // fresh process start is unreliable on some OEMs (notably MIUI) —
            // that was the root cause of "auto-fill stops working after
            // bubble off→on until Accessibility is manually toggled". Keeping
            // the service (and process) alive in the background avoids that
            // rebind entirely, so auto-fill keeps working every time.
            try {
                Intent intent = new Intent(ctx, BubbleService.class);
                intent.setAction("HIDE");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    ctx.startForegroundService(intent);
                else
                    ctx.startService(intent);
                bubbleRunning = false;
            } catch (Exception e) { Log.e(TAG, "stopBubble: " + e.getMessage()); }
        }

        @JavascriptInterface
        public boolean isBubbleRunning() { return bubbleRunning; }

        @JavascriptInterface
        public String readClipboard() {
            try {
                ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm == null || !cm.hasPrimaryClip()) return "";
                ClipData.Item item = cm.getPrimaryClip().getItemAt(0);
                CharSequence text = item.getText();
                return text != null ? text.toString() : "";
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void writeClipboard(String text) {
            try {
                ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("xenox", text));
            } catch (Exception e) { Log.e(TAG, "writeClipboard: " + e.getMessage()); }
        }

        @JavascriptInterface
        public String getFcmToken() {
            return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString("fcm_token", "");
        }

        @JavascriptInterface
        public void saveConfig(String json) {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString("float_config", json).apply();
        }

        @JavascriptInterface
        public String loadConfig() {
            return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString("float_config", "{}");
        }

        @JavascriptInterface
        public String getLocalSheetData() {
            return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString("local_sheet_data", "{}");
        }

        @JavascriptInterface
        public void saveLocalSheetData(String json) {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString("local_sheet_data", json).apply();
        }

        @JavascriptInterface
        public String appendLocalSheet(String col, String text) {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString("local_sheet_data", "{}");
                JSONObject data = new JSONObject(raw);
                JSONArray arr = data.optJSONArray(col);
                if (arr == null) arr = new JSONArray();
                arr.put(text.length() > 400 ? text.substring(0, 400) : text);
                data.put(col, arr);
                prefs.edit().putString("local_sheet_data", data.toString()).apply();
                return String.valueOf(arr.length());
            } catch (Exception e) { return "0"; }
        }

        @JavascriptInterface
        public String deleteLocalSheet(String col) {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString("local_sheet_data", "{}");
                JSONObject data = new JSONObject(raw);
                JSONArray arr = data.optJSONArray(col);
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

        @JavascriptInterface
        public void showNativeNotification(String title, String message) {
            createNotifChannel();
            Intent intent = new Intent(ctx, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                ctx, (int) System.currentTimeMillis(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            android.net.Uri sound = android.media.RingtoneManager.getDefaultUri(
                android.media.RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder nb = new NotificationCompat.Builder(ctx, "xenox_ch")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setSound(sound)
                .setVibrate(new long[]{0, 250, 100, 250})
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .setContentIntent(pi);

            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify((int) System.currentTimeMillis(), nb.build());
        }

        @JavascriptInterface
        public void clearLocalSheetData() {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().remove("local_sheet_data").apply();
        }

        @JavascriptInterface
        public boolean downloadFile(String base64Data, String filename, String mimeType) {
            try {
                byte[] data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                String safeMime = (mimeType == null || mimeType.isEmpty())
                    ? "application/octet-stream" : mimeType;

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    // Android 10+ (API 29+): use MediaStore — no WRITE_EXTERNAL_STORAGE needed
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, filename);
                    cv.put(android.provider.MediaStore.Downloads.MIME_TYPE, safeMime);
                    cv.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                    android.net.Uri collection = android.provider.MediaStore.Downloads
                        .getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    android.net.Uri itemUri = ctx.getContentResolver().insert(collection, cv);
                    if (itemUri != null) {
                        try (java.io.OutputStream os = ctx.getContentResolver().openOutputStream(itemUri)) {
                            if (os != null) os.write(data);
                        }
                        cv.clear();
                        cv.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                        ctx.getContentResolver().update(itemUri, cv, null, null);
                        runOnUiThread(() -> Toast.makeText(ctx,
                            "✅ Saved to Downloads: " + filename, Toast.LENGTH_LONG).show());
                        return true;
                    }
                    return false;
                } else {
                    // Android 9 and below: use classic file API (WRITE_EXTERNAL_STORAGE granted)
                    java.io.File downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(
                        android.os.Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) downloadsDir.mkdirs();
                    java.io.File file = new java.io.File(downloadsDir, filename);
                    try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file)) {
                        fos.write(data);
                    }
                    android.media.MediaScannerConnection.scanFile(ctx,
                        new String[]{ file.getAbsolutePath() }, null, null);
                    runOnUiThread(() -> Toast.makeText(ctx,
                        "✅ Saved to Downloads: " + filename, Toast.LENGTH_LONG).show());
                    return true;
                }
            } catch (Exception e) {
                Log.e(TAG, "downloadFile: " + e.getMessage());
                return false;
            }
        }

        @JavascriptInterface
        public boolean shareFile(String base64Data, String filename, String mimeType) {
            try {
                byte[] data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                java.io.File cacheDir = new java.io.File(ctx.getCacheDir(), "xenox_share");
                cacheDir.mkdirs();
                java.io.File file = new java.io.File(cacheDir, filename);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file)) { fos.write(data); }

                android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(
                    ctx, ctx.getPackageName() + ".provider", file);

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(mimeType.isEmpty() ? "*/*" : mimeType);
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, filename);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, "Share " + filename);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(chooser);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "shareFile: " + e.getMessage());
                return false;
            }
        }

        @JavascriptInterface
        public boolean shareDiagLog() {
            // TEMPORARY: shares the on-device diagnostic log written by DiagLogger
            // (accessibility malfunction tracing) so it can be sent without a PC/adb.
            try {
                java.io.File src = DiagLogger.getFile(ctx);
                if (!src.exists() || src.length() == 0) {
                    String err = DiagLogger.getLastError();
                    String msg = err != null
                        ? "No diagnostic log — write failed: " + err
                        : "No diagnostic log yet — reproduce the issue first";
                    runOnUiThread(() -> Toast.makeText(ctx, msg, Toast.LENGTH_LONG).show());
                    return false;
                }
                android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(
                    ctx, ctx.getPackageName() + ".provider", src);

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("text/plain");
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Xenox diagnostic log");
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, "Send diagnostic log");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(chooser);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "shareDiagLog: " + e.getMessage());
                return false;
            }
        }

        @JavascriptInterface
        public boolean openAutostartSettings() {
            // Best-effort deep link into the OEM-specific "autostart" / "protected apps"
            // manager. Xiaomi/Vivo/Oppo/Samsung revoke a killed app's Accessibility
            // permission unless this is enabled, and there is no public API to
            // enable it programmatically — the user must flip it once manually.
            String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
            String pkg = ctx.getPackageName();
            java.util.List<Intent> candidates = new java.util.ArrayList<>();

            if (manufacturer.contains("xiaomi")) {
                candidates.add(new Intent().setClassName("com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                candidates.add(new Intent("miui.intent.action.OP_AUTO_START")
                    .addCategory(Intent.CATEGORY_DEFAULT));
            } else if (manufacturer.contains("vivo")) {
                candidates.add(new Intent().setClassName("com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"));
                candidates.add(new Intent().setClassName("com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
            } else if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
                candidates.add(new Intent().setClassName("com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
                candidates.add(new Intent().setClassName("com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity"));
            } else if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
                candidates.add(new Intent().setClassName("com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
            } else if (manufacturer.contains("samsung")) {
                candidates.add(new Intent().setClassName("com.samsung.android.lool",
                    "com.samsung.android.sm.ui.battery.BatteryActivity"));
            }

            for (Intent i : candidates) {
                try {
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(i);
                    return true;
                } catch (Exception ignored) { /* try next candidate */ }
            }

            // Fallback: generic app details page where the user can usually find
            // battery / autostart controls under this OEM's own naming.
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + pkg));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "openAutostartSettings: " + e.getMessage());
                return false;
            }
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            } catch (Exception e) { Log.e(TAG, "openExternalUrl: " + e.getMessage()); }
        }

        @JavascriptInterface
        public void reload() {
            runOnUiThread(() -> webView.reload());
        }

        // ── Platform WebView (Instagram / Facebook) ───────────────────────────

        /**
         * Called from React's BrowserScreen on mount.
         * Creates a native WebView and attaches it to mainFrame below the React
         * top bar (whose bottom edge in screen pixels is passed as topPx).
         */
        @JavascriptInterface
        public void attachPlatformWebView(String platform, int topPx) {
            runOnUiThread(() -> {
                if (mainFrame == null) return;
                // Remove any existing platform WebView first
                detachPlatformWebViewInternal();

                platformWebView = new WebView(ctx);
                platformWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

                android.webkit.WebSettings ps = platformWebView.getSettings();
                ps.setJavaScriptEnabled(true);
                ps.setDomStorageEnabled(true);
                ps.setSupportMultipleWindows(true);
                ps.setDatabaseEnabled(true);
                ps.setAllowFileAccess(true);
                ps.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                ps.setUserAgentString(
                    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36");

                platformWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                        // All Instagram/Facebook URLs stay inside platformWebView
                        String url = req.getUrl().toString();
                        platformCurrentUrl = url;
                        return false;
                    }
                    @Override
                    public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                        if (url != null) platformCurrentUrl = url;
                    }
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (url != null) platformCurrentUrl = url;
                    }
                });

                platformWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> cb,
                                                     FileChooserParams params) {
                        if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                        fileChooserCallback = cb;
                        Intent intent = params.createIntent();
                        try {
                            startActivityForResult(intent, FILE_CHOOSER_CODE);
                        } catch (Exception e) {
                            fileChooserCallback = null;
                            return false;
                        }
                        return true;
                    }
                });

                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT);
                lp.topMargin = topPx;
                mainFrame.addView(platformWebView, lp);

                String homeUrl = "instagram".equals(platform)
                    ? "https://www.instagram.com/"
                    : "https://www.facebook.com/";
                platformCurrentUrl = homeUrl;
                platformWebView.loadUrl(homeUrl);
            });
        }

        /**
         * Navigate the platform WebView to a new URL (called by nav button taps).
         */
        @JavascriptInterface
        public void navigatePlatformWebView(String url) {
            if (url == null || url.isEmpty()) return;
            runOnUiThread(() -> {
                if (platformWebView != null) {
                    platformCurrentUrl = url;
                    platformWebView.loadUrl(url);
                }
            });
        }

        /**
         * Detach and destroy the platform WebView (called by React on unmount/back).
         */
        @JavascriptInterface
        public void detachPlatformWebView() {
            runOnUiThread(MainActivity.this::detachPlatformWebViewInternal);
        }

        /**
         * Clear ONLY the platform WebView's cookies, cache, and history —
         * i.e. log the user out of Instagram/Facebook without touching the
         * HBX Short app session, SharedPreferences, or the main webView.
         * After clearing, navigates the platform WebView to homeUrl.
         */
        @JavascriptInterface
        public void clearPlatformWebViewData(String homeUrl) {
            runOnUiThread(() -> {
                if (platformWebView == null) return;

                // Remove cookies for instagram.com / facebook.com only
                android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
                cm.removeAllCookies(null);
                cm.flush();

                // Clear cache and history of the platform WebView only
                platformWebView.clearCache(true);
                platformWebView.clearHistory();

                // Reload the home page so the user sees the logged-out state
                if (homeUrl != null && !homeUrl.isEmpty()) {
                    platformCurrentUrl = homeUrl;
                    platformWebView.loadUrl(homeUrl);
                }
            });
        }

        /**
         * Get cookies for the current platform WebView URL, copy them to the
         * clipboard and show a toast. Called when user taps the Cookies button.
         */
        @JavascriptInterface
        public void copyPlatformCookies() {
            String url = platformCurrentUrl;
            if (url == null || url.isEmpty()) {
                runOnUiThread(() -> Toast.makeText(ctx, "No page loaded yet", Toast.LENGTH_SHORT).show());
                return;
            }
            android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
            String cookies = cm.getCookie(url);
            if (cookies == null || cookies.isEmpty()) {
                runOnUiThread(() -> Toast.makeText(ctx, "No cookies found", Toast.LENGTH_SHORT).show());
                return;
            }
            // Copy to clipboard (must run on main thread)
            String finalCookies = cookies;
            runOnUiThread(() -> {
                try {
                    ClipboardManager clipboard =
                        (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(ClipData.newPlainText("cookies", finalCookies));
                    }
                } catch (Exception ignored) {}
                Toast.makeText(ctx, "Cookies copied!", Toast.LENGTH_SHORT).show();
            });
        }

        private void createNotifChannel() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                    "xenox_ch", "HBX Short Notifications",
                    NotificationManager.IMPORTANCE_HIGH);
                ch.enableVibration(true);
                ch.enableLights(true);
                ch.setShowBadge(true);
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.createNotificationChannel(ch);
            }
        }
    }
}
