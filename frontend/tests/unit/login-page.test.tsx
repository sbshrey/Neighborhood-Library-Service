// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const loginMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  login: vi.fn(),
  bootstrapAdmin: vi.fn(),
  setStoredToken: vi.fn(),
  setStoredUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: loginMocks.replace }),
}));

vi.mock("../../lib/api", () => ({
  login: loginMocks.login,
  bootstrapAdmin: loginMocks.bootstrapAdmin,
}));

vi.mock("../../lib/auth", () => ({
  setStoredToken: loginMocks.setStoredToken,
  setStoredUser: loginMocks.setStoredUser,
}));

import LoginPage from "../../app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("signs in and redirects with trimmed email", async () => {
    const user = userEvent.setup();
    loginMocks.login.mockResolvedValue({
      access_token: "token-1",
      user: { id: 1, name: "Admin", email: "admin@library.dev", role: "admin" },
    });

    render(<LoginPage />);

    await user.type(screen.getByTestId("login-email"), " admin@library.dev ");
    await user.type(screen.getByTestId("login-password"), "pass123");
    await user.click(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(loginMocks.login).toHaveBeenCalledWith({
        email: "admin@library.dev",
        password: "pass123",
      })
    );

    expect(loginMocks.setStoredToken).toHaveBeenCalledWith("token-1");
    expect(loginMocks.setStoredUser).toHaveBeenCalledWith({
      id: 1,
      name: "Admin",
      email: "admin@library.dev",
      role: "admin",
    });
    expect(loginMocks.replace).toHaveBeenCalledWith("/");
  });

  test("shows validation message for incomplete bootstrap form", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Bootstrap Admin (First Run)" }));

    expect(
      screen.getByText("Enter name, email, and password to bootstrap the first admin.")
    ).toBeTruthy();
    expect(loginMocks.bootstrapAdmin).not.toHaveBeenCalled();
  });

  test("bootstraps admin then signs in", async () => {
    const user = userEvent.setup();
    loginMocks.bootstrapAdmin.mockResolvedValue({ id: 99 });
    loginMocks.login.mockResolvedValue({
      access_token: "bootstrap-token",
      user: { id: 99, name: "Shrey", email: "shrey@library.dev", role: "admin" },
    });

    render(<LoginPage />);

    await user.type(screen.getByTestId("login-name"), "  Shrey  ");
    await user.type(screen.getByTestId("login-email"), " shrey@library.dev ");
    await user.type(screen.getByTestId("login-password"), " Admin@12345 ");
    await user.click(screen.getByRole("button", { name: "Bootstrap Admin (First Run)" }));

    await waitFor(() =>
      expect(loginMocks.bootstrapAdmin).toHaveBeenCalledWith({
        name: "Shrey",
        email: "shrey@library.dev",
        role: "admin",
        password: "Admin@12345",
      })
    );
    expect(loginMocks.login).toHaveBeenCalledWith({
      email: "shrey@library.dev",
      password: "Admin@12345",
    });
    expect(loginMocks.replace).toHaveBeenCalledWith("/");
  });
});
