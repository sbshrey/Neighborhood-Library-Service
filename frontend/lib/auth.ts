export type AuthUser = {
  id: number;
  name: string;
  email: string | null;
  role: string;
};

const TOKEN_KEY = "nls_access_token";
const USER_KEY = "nls_auth_user";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getStoredToken(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  clearStoredToken();
  clearStoredUser();
}
