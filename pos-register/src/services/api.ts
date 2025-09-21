/*
const BASE =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== "undefined" ? "http://localhost:4000" : "");
*/
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// Build query string
function qs(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// Always attach Accept + Authorization if token exists
function authHeaders(extra?: Record<string, string>) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = new Headers({ Accept: "application/json" });
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiGet<T>(path: string, params?: Record<string, any>) {
  const res = await fetch(`${BASE}${path}${qs(params)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiPut<T>(path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiDel<T = any>(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handle<T>(res);
}

// IMPORTANT: do NOT set Content-Type; the browser will set the correct boundary
export async function apiPostForm<T>(path: string, formData: FormData) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders(), // includes Authorization
    body: formData,
  });
  return handle<T>(res);
}
