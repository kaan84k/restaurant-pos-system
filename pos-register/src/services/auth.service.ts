import { API_URL } from "../config";

export type Role = "CASHIER" | "MANAGER" | "ADMIN";
export type AuthUser = { id: number; name: string; role: Role };

export async function loginByPin(
  pin: string
): Promise<{ token: string; user: AuthUser }> {
  const r = await fetch(new URL("/auth/login", API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function checkPin(
  pin: string
): Promise<{ ok: boolean; user?: AuthUser }> {
  const r = await fetch(new URL("/auth/check-pin", API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!r.ok) return { ok: false };
  return r.json();
}
