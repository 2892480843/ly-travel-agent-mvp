import type { IncomingMessage, ServerResponse } from "node:http";
import type { Role } from "../src/types";
import { verifyPassword } from "./security";
import { createSession, deleteSession, getSessionUser, getUserByRole, type AuthUser } from "./repositories";

const cookieName = process.env.AUTH_COOKIE_NAME ?? "ly_session";

const travelerPermissions = ["orders:own", "tickets:lock", "payments:own", "maps:read"];

const permissions: Record<Role, string[]> = {
  visitor: travelerPermissions,
  merchant: [...travelerPermissions, "orders:merchant", "tickets:verify"],
  reviewer: [...travelerPermissions, "reviews:write", "admin:read"],
  operator: [...travelerPermissions, "admin:read", "merchants:write", "reviews:write", "orders:read"],
  admin: ["*"]
};

export type AuthContext = {
  authenticated: boolean;
  user?: AuthUser;
  sessionId?: string;
};

export function authenticateRequest(request: IncomingMessage): AuthContext {
  const sessionId = parseCookies(request.headers.cookie ?? "")[cookieName];
  if (!sessionId) return { authenticated: false };
  const user = getSessionUser(sessionId);
  if (!user) return { authenticated: false, sessionId };
  return { authenticated: true, user, sessionId };
}

export function loginWithRole(role: Role, password: string) {
  const user = getUserByRole(role);
  if (!user || !verifyPassword(password, user.password_hash)) return undefined;
  const session = createSession(user.id);
  return {
    session,
    user: { id: user.id, name: user.name, role: user.role }
  };
}

export function clearSession(response: ServerResponse, sessionId?: string) {
  if (sessionId) deleteSession(sessionId);
  response.setHeader("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export function setSessionCookie(response: ServerResponse, sessionId: string, expiresAt: string) {
  response.setHeader("Set-Cookie", `${cookieName}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}`);
}

export function can(user: AuthUser | undefined, permission: string) {
  if (!user) return false;
  const granted = permissions[user.role] ?? [];
  return granted.includes("*") || granted.includes(permission);
}

export function requireAuth(context: AuthContext, permission?: string) {
  if (!context.authenticated || !context.user) {
    return { status: 401, message: "Authentication is required" };
  }
  if (permission && !can(context.user, permission)) {
    return { status: 403, message: "Permission is required" };
  }
  return undefined;
}

function parseCookies(cookieHeader: string) {
  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [key, ...value] = part.trim().split("=");
    if (key) cookies[key] = decodeURIComponent(value.join("="));
    return cookies;
  }, {});
}
