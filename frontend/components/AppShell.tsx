"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getMe } from "../lib/api";
import { AuthUser, clearAuth, getStoredToken, getStoredUser, setStoredUser } from "../lib/auth";
import SidebarNav from "./SidebarNav";
import ToastProvider from "./ToastProvider";

const adminOnlyRoutes = ["/settings", "/catalog", "/users", "/roles", "/audit"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      if (pathname === "/login") {
        if (getStoredToken()) {
          router.replace("/");
        }
        setReady(true);
        return;
      }

      const token = getStoredToken();
      if (!token) {
        clearAuth();
        router.replace("/login");
        setReady(true);
        return;
      }

      const cachedUser = getStoredUser();
      if (cachedUser && mounted) {
        setUser(cachedUser);
      }

      try {
        const me = await getMe();
        if (!mounted) return;
        if (!["admin", "staff"].includes(me.role)) {
          clearAuth();
          router.replace("/login");
          return;
        }
        if (adminOnlyRoutes.includes(pathname) && me.role !== "admin") {
          router.replace("/");
          return;
        }
        setStoredUser(me);
        setUser(me);
      } catch {
        if (!mounted) return;
        clearAuth();
        router.replace("/login");
      } finally {
        if (mounted) setReady(true);
      }
    };

    checkSession();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (pathname === "/login") {
    return (
      <ToastProvider>
        <main className="auth-page">{children}</main>
      </ToastProvider>
    );
  }

  if (!ready) {
    return (
      <ToastProvider>
        <main className="auth-page">
          <section className="auth-card">
            <h2>Checking Session</h2>
            <p className="lede">Verifying access token...</p>
          </section>
        </main>
      </ToastProvider>
    );
  }

  const onLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  return (
    <ToastProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">N</div>
            <div>
              <div className="brand-title">Neighborhood</div>
              <div className="brand-subtitle">Library Service</div>
            </div>
          </div>
          <SidebarNav user={user} />
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="meta-label">Signed in</div>
              <div className="meta-value">{user?.name || "Unknown user"}</div>
              <div className="brand-subtitle">{user?.role || "member"}</div>
              <button className="ghost" onClick={onLogout}>
                Logout
              </button>
            </div>
            <div className="sidebar-note">
              Staff portal for borrowings, returns, and fine tracking.
            </div>
          </div>
        </aside>
        <div className="app-main">
          <main className="page">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
