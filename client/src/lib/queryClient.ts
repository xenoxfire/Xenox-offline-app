import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getPerformanceMode } from "./performanceMode";

// ── Fully offline "API" ────────────────────────────────────────────────────
// The old web app talked to an Express/Postgres server. This build has no
// server: every /api/... call used by the app is answered from localStorage,
// so Local Data and 2FA Tools keep working exactly the same on the phone.

const STORE_PREFIX = "xenox_local_store:";

type Row = Record<string, any> & { id: string };

function readList(name: string): Row[] {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + name);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(name: string, rows: Row[]) {
  try {
    localStorage.setItem(STORE_PREFIX + name, JSON.stringify(rows));
  } catch {}
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  } catch {}
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const COLLECTIONS: Record<string, string> = {
  "/api/local-data": "local-data",
  "/api/2fa-codes": "2fa-codes",
};

function handleLocal(method: string, url: string, body?: any): Response {
  const clean = url.split("?")[0].replace(/\/+$/, "");
  const base = Object.keys(COLLECTIONS).find((b) => clean === b || clean.startsWith(b + "/"));
  if (!base) return jsonResponse({ error: "Not available offline" }, 404);

  const name = COLLECTIONS[base];
  const id = clean.length > base.length ? decodeURIComponent(clean.slice(base.length + 1)) : "";
  const rows = readList(name);
  const m = method.toUpperCase();

  if (m === "GET") {
    if (!id) return jsonResponse([...rows].reverse());
    const row = rows.find((r) => r.id === id);
    return row ? jsonResponse(row) : jsonResponse({ error: "Not found" }, 404);
  }

  if (m === "POST" && !id) {
    const row: Row = { ...(body || {}), id: newId(), createdAt: new Date().toISOString() };
    rows.push(row);
    writeList(name, rows);
    return jsonResponse(row, 201);
  }

  if (m === "PATCH" && id) {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return jsonResponse({ error: "Not found" }, 404);
    rows[idx] = { ...rows[idx], ...(body || {}), id };
    writeList(name, rows);
    return jsonResponse(rows[idx]);
  }

  if (m === "DELETE" && id) {
    writeList(name, rows.filter((r) => r.id !== id));
    return new Response(null, { status: 204 });
  }

  return jsonResponse({ error: "Unsupported" }, 405);
}

export async function fetchJsonWithCache<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = handleLocal("GET", url);
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = handleLocal(method, url, data);
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

export const getQueryFn: <T>(options: { on401: "returnNull" | "throw" }) => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = handleLocal("GET", url);
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return (await res.json()) as any;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 0,
      gcTime: getPerformanceMode().safeMode ? 2 * 60_000 : 5 * 60_000,
      retry: 0,
      networkMode: "always",
    },
    mutations: {
      retry: 0,
      networkMode: "always",
    },
  },
});
