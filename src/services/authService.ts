import type { AuthState, DemoUser, Role } from "../types";

const storageKey = "ly.demo.user";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const demoUsers: DemoUser[] = [
  { id: "visitor", name: "游客小陈", role: "visitor" },
  { id: "operator", name: "张运营", role: "operator" },
  { id: "reviewer", name: "王审核", role: "reviewer" },
  { id: "merchant", name: "云谷商户", role: "merchant" },
  { id: "admin", name: "系统管理员", role: "admin" }
];

export function getCurrentUser(): DemoUser {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as DemoUser;
  } catch {
    // Ignore malformed demo auth data.
  }
  return demoUsers[0];
}

export function setCurrentRole(role: Role) {
  const user = demoUsers.find((item) => item.role === role) ?? demoUsers[0];
  window.localStorage.setItem(storageKey, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("ly:role-change", { detail: user }));
  return user;
}

export async function fetchCurrentAuth(): Promise<AuthState> {
  if (!API_BASE) {
    return { authenticated: false, user: getCurrentUser() };
  }
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (!response.ok) throw new Error(`Auth request failed: ${response.status}`);
    const state = await response.json() as AuthState;
    window.localStorage.setItem(storageKey, JSON.stringify(state.user));
    window.dispatchEvent(new CustomEvent("ly:role-change", { detail: state.user }));
    return state;
  } catch {
    return { authenticated: false, user: getCurrentUser() };
  }
}

export async function loginAsRole(role: Role, password = "sandbox"): Promise<AuthState> {
  if (!API_BASE) {
    return { authenticated: false, user: setCurrentRole(role) };
  }
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, password })
    });
    if (!response.ok) throw new Error(`Login failed: ${response.status}`);
    const state = await response.json() as AuthState;
    window.localStorage.setItem(storageKey, JSON.stringify(state.user));
    window.dispatchEvent(new CustomEvent("ly:role-change", { detail: state.user }));
    return state;
  } catch {
    return { authenticated: false, user: setCurrentRole(role) };
  }
}

export async function logout() {
  if (API_BASE) {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
  }
  const user = demoUsers[0];
  window.localStorage.setItem(storageKey, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("ly:role-change", { detail: user }));
  return user;
}

export function canAccess(pathname: string, role: Role) {
  if (role === "admin") return true;
  if (pathname === "/merchant") return role === "merchant";
  if (pathname.startsWith("/admin/review")) return role === "reviewer" || role === "operator";
  if (pathname.startsWith("/admin")) return role === "operator";
  return true;
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    visitor: "游客",
    operator: "运营人员",
    reviewer: "审核人员",
    merchant: "商户",
    admin: "管理员"
  };
  return labels[role];
}
