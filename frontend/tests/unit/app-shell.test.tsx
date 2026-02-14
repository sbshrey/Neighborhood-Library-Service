// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const shellMocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
  router: { replace: vi.fn() },
  replace: vi.fn(),
  getMe: vi.fn(),
  getStoredToken: vi.fn(() => null as string | null),
  getStoredUser: vi.fn(() => null),
  setStoredUser: vi.fn(),
  clearAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: shellMocks.usePathname,
  useRouter: () => shellMocks.router,
}));

vi.mock("../../lib/api", () => ({
  getMe: shellMocks.getMe,
}));

vi.mock("../../lib/auth", () => ({
  getStoredToken: shellMocks.getStoredToken,
  getStoredUser: shellMocks.getStoredUser,
  setStoredUser: shellMocks.setStoredUser,
  clearAuth: shellMocks.clearAuth,
}));

vi.mock("../../components/SidebarNav", () => ({
  default: () => <div data-testid="sidebar-nav-mock" />,
}));

import AppShell from "../../components/AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shellMocks.router.replace = shellMocks.replace;
    shellMocks.usePathname.mockReturnValue("/");
    shellMocks.getStoredToken.mockReturnValue(null);
    shellMocks.getStoredUser.mockReturnValue(null);
    shellMocks.getMe.mockResolvedValue({
      id: 1,
      name: "Staff",
      email: "staff@library.dev",
      role: "staff",
    });
  });

  test("renders login route without auth checks", () => {
    shellMocks.usePathname.mockReturnValue("/login");

    render(
      <AppShell>
        <div>Login Child</div>
      </AppShell>
    );

    expect(screen.getByText("Login Child")).toBeTruthy();
    expect(shellMocks.getMe).not.toHaveBeenCalled();
  });

  test("redirects authenticated user away from login page", () => {
    shellMocks.usePathname.mockReturnValue("/login");
    shellMocks.getStoredToken.mockReturnValue("token-1");

    render(
      <AppShell>
        <div>Login Child</div>
      </AppShell>
    );

    expect(shellMocks.replace).toHaveBeenCalledWith("/");
  });

  test("redirects to login when token is missing", async () => {
    shellMocks.usePathname.mockReturnValue("/");
    shellMocks.getStoredToken.mockReturnValue(null);

    render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.clearAuth).toHaveBeenCalledTimes(1));
    expect(shellMocks.replace).toHaveBeenCalledWith("/login");
  });

  test("redirects member user away from staff dashboard", async () => {
    shellMocks.usePathname.mockReturnValue("/");
    shellMocks.getStoredToken.mockReturnValue("token-1");
    shellMocks.getMe.mockResolvedValue({
      id: 9,
      name: "Member",
      email: "member@library.dev",
      role: "member",
    });

    render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.replace).toHaveBeenCalledWith("/member"));
  });

  test("redirects staff away from member page", async () => {
    shellMocks.usePathname.mockReturnValue("/member");
    shellMocks.getStoredToken.mockReturnValue("token-1");
    shellMocks.getMe.mockResolvedValue({
      id: 3,
      name: "Staff",
      email: "staff@library.dev",
      role: "staff",
    });

    render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.replace).toHaveBeenCalledWith("/"));
  });

  test("redirects non-admin away from admin-only route", async () => {
    shellMocks.usePathname.mockReturnValue("/settings");
    shellMocks.getStoredToken.mockReturnValue("token-1");
    shellMocks.getMe.mockResolvedValue({
      id: 4,
      name: "Staff",
      email: "staff2@library.dev",
      role: "staff",
    });

    render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.replace).toHaveBeenCalledWith("/"));
  });

  test("clears auth when API returns invalid role", async () => {
    shellMocks.usePathname.mockReturnValue("/");
    shellMocks.getStoredToken.mockReturnValue("token-1");
    shellMocks.getMe.mockResolvedValue({
      id: 8,
      name: "Unknown",
      email: "unknown@library.dev",
      role: "owner",
    });

    render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.clearAuth).toHaveBeenCalled());
    expect(shellMocks.replace).toHaveBeenCalledWith("/login");
  });

  test("handles getMe failure by clearing auth", async () => {
    shellMocks.usePathname.mockReturnValue("/");
    shellMocks.getStoredToken.mockReturnValue("token-1");
    shellMocks.getMe.mockRejectedValue(new Error("network"));

    render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.clearAuth).toHaveBeenCalled());
    expect(shellMocks.replace).toHaveBeenCalledWith("/login");
  });

  test("logout button clears auth and redirects", async () => {
    shellMocks.usePathname.mockReturnValue("/");
    shellMocks.getStoredToken.mockReturnValue("token-1");
    shellMocks.getMe.mockResolvedValue({
      id: 1,
      name: "Admin",
      email: "admin@library.dev",
      role: "admin",
    });

    const { getByTestId } = render(
      <AppShell>
        <div>Protected</div>
      </AppShell>
    );

    await waitFor(() => expect(shellMocks.setStoredUser).toHaveBeenCalled());
    getByTestId("logout-btn").click();

    expect(shellMocks.clearAuth).toHaveBeenCalled();
    expect(shellMocks.replace).toHaveBeenCalledWith("/login");
  });
});
