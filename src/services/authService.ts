import type { AuthState, DemoUser, Role } from "../types";

const storageKey = "ly.demo.user";
const API_BASE = normalizeLocalApiBase(import.meta.env.VITE_API_BASE_URL ?? "");
let memoryUser: DemoUser | undefined;

export const demoUsers: DemoUser[] = [
  { id: "visitor", name: "游客小陈", role: "visitor" },
  { id: "operator", name: "张运营", role: "operator" },
  { id: "reviewer", name: "王审核", role: "reviewer" },
  { id: "merchant", name: "武昌商户", role: "merchant" },
  { id: "admin", name: "系统管理员", role: "admin" }
];

function normalizeLocalApiBase(base: string) {
  if (!base || typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return base;
  }
  return base;
}

export function getCurrentUser(): DemoUser {
  const queryUser = getQueryUser();
  if (queryUser) return queryUser;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as DemoUser;
  } catch {
    // Ignore malformed demo auth data.
  }
  if (memoryUser) return memoryUser;
  return demoUsers[0];
}

export function setCurrentRole(role: Role) {
  const user = demoUsers.find((item) => item.role === role) ?? demoUsers[0];
  persistUser(user);
  return user;
}

function persistUser(user: DemoUser) {
  memoryUser = user;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(user));
  } catch {
    // Some embedded browsers disable localStorage; keep the demo role in memory.
  }
  window.dispatchEvent(new CustomEvent("ly:role-change", { detail: user }));
}

export async function fetchCurrentAuth(): Promise<AuthState> {
  const queryUser = getQueryUser();
  if (queryUser) return { authenticated: false, user: queryUser };
  if (!API_BASE) {
    return { authenticated: false, user: getCurrentUser() };
  }
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (!response.ok) throw new Error(`Auth request failed: ${response.status}`);
    const state = await response.json() as AuthState;
    const localUser = getCurrentUser();
    if (!state.authenticated) {
      return await loginAsRole(localUser.role);
    }
    const resolvedState = { ...state, user: state.user ?? localUser };
    persistUser(resolvedState.user);
    return resolvedState;
  } catch {
    return { authenticated: false, user: getCurrentUser() };
  }
}

function getQueryUser() {
  const queryRole = new URLSearchParams(window.location.search).get("role") as Role | null;
  return demoUsers.find((item) => item.role === queryRole);
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
    persistUser(state.user);
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
  persistUser(user);
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
