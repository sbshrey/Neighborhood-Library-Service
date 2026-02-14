import { beforeEach, describe, expect, test } from "vitest";

import {
  clearAuth,
  clearStoredToken,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from "../../lib/auth";

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

describe("auth storage helpers", () => {
  beforeEach(() => {
    (globalThis as any).window = { localStorage: new LocalStorageMock() };
    window.localStorage.clear();
  });

  test("stores and retrieves token", () => {
    setStoredToken("abc-token");
    expect(getStoredToken()).toBe("abc-token");
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  test("stores and retrieves auth user", () => {
    setStoredUser({
      id: 9,
      name: "Shrey",
      email: "shrey@example.com",
      role: "admin",
    });

    expect(getStoredUser()).toEqual({
      id: 9,
      name: "Shrey",
      email: "shrey@example.com",
      role: "admin",
    });
  });

  test("returns null for malformed stored user JSON", () => {
    window.localStorage.setItem("nls_auth_user", "{bad-json");
    expect(getStoredUser()).toBeNull();
  });

  test("clearAuth removes both token and user", () => {
    setStoredToken("xyz");
    setStoredUser({
      id: 1,
      name: "User",
      email: null,
      role: "staff",
    });

    clearAuth();

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});
