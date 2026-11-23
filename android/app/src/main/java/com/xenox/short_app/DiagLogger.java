package com.xenox.short_app;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * TEMPORARY diagnostic file logger used to trace the exact cause of the
 * "This service is malfunctioning" bug when no PC/adb is available on the
 * test device. Writes to a plain text file inside app-private external
 * storage (no special permission needed on API 19+) and can be shared
 * through the existing FileProvider via MainActivity's shareDiagLog().
 *
 * Rotates the file once it exceeds ~1.5 MB so a long test session cannot
 * fill the disk. Purely additive — does not change any existing behavior.
 */
final class DiagLogger {

    private static final String FILE_NAME = "xenox_diag.log";
    private static final long MAX_BYTES = 1_500_000L;
    private static final SimpleDateFormat FMT =
        new SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US);

    private DiagLogger() {}

    // Exposed so the UI can show the *real* failure reason instead of a generic
    // "no log yet" when writing itself is silently failing (no adb available to
    // read Logcat on the test device).
    private static volatile String lastError = null;

    static String getLastError() {
        return lastError;
    }

    private static File logFile(Context ctx) {
        File dir = ctx.getExternalFilesDir(null);
        if (dir == null) dir = ctx.getFilesDir();
        // getExternalFilesDir() is documented to create the directory, but on some
        // OEM builds / storage states it can return a path that doesn't actually
        // exist yet, which makes FileOutputStream throw FileNotFoundException.
        // Force-create it defensively so a missing directory is never the reason
        // the log silently fails to write.
        if (!dir.exists() && !dir.mkdirs() && !dir.exists()) {
            // Directory truly can't be created (e.g. external storage unavailable) —
            // fall back to internal app storage, which always exists.
            dir = ctx.getFilesDir();
        }
        return new File(dir, FILE_NAME);
    }

    static synchronized void log(Context ctx, String tag, String msg) {
        writeLine(ctx, "I", tag, msg, null);
    }

    static synchronized void warn(Context ctx, String tag, String msg) {
        writeLine(ctx, "W", tag, msg, null);
    }

    static synchronized void error(Context ctx, String tag, String msg, Throwable t) {
        writeLine(ctx, "E", tag, msg, t);
    }

    private static void writeLine(Context ctx, String level, String tag, String msg, Throwable t) {
        StringBuilder sb = new StringBuilder();
        sb.append(FMT.format(new Date()))
          .append(" pid=").append(android.os.Process.myPid())
          .append(' ').append(level)
          .append('/').append(tag).append(": ").append(msg).append('\n');
        if (t != null) {
            sb.append("    -> ").append(Log.getStackTraceString(t).replace("\n", "\n    "));
        }
        byte[] bytes;
        try {
            bytes = sb.toString().getBytes("UTF-8");
        } catch (Exception e) {
            return; // should never happen
        }

        // Primary attempt: app-private external storage (shareable, no permission needed).
        if (tryWrite(logFile(ctx), bytes)) return;

        // Fallback: internal app storage. Not shareable via the same FileProvider path
        // unless file_paths.xml also covers files-path, but at least proves whether the
        // external location specifically is the problem.
        File fallback = new File(ctx.getFilesDir(), FILE_NAME);
        if (tryWrite(fallback, bytes)) {
            lastError = "wrote to internal fallback (external dir failed)";
            return;
        }

        Log.e("DiagLogger", "failed to write diag log anywhere: " + lastError);
    }

    private static boolean tryWrite(File f, byte[] bytes) {
        try {
            if (f.exists() && f.length() > MAX_BYTES) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
            File parent = f.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }
            try (FileOutputStream fos = new FileOutputStream(f, true)) {
                fos.write(bytes);
            }
            return true;
        } catch (Exception e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage() + " (path=" + f.getAbsolutePath() + ")";
            return false;
        }
    }

    static File getFile(Context ctx) {
        File primary = logFile(ctx);
        if (primary.exists() && primary.length() > 0) return primary;
        File fallback = new File(ctx.getFilesDir(), FILE_NAME);
        if (fallback.exists() && fallback.length() > 0) return fallback;
        return primary; // doesn't exist anywhere — caller reports "no log yet"
    }
}
