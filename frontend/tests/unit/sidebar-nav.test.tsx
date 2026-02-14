// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const navMocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: navMocks.usePathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SidebarNav from "../../components/SidebarNav";

describe("SidebarNav", () => {
  test("shows admin links and marks current route active", () => {
    navMocks.usePathname.mockReturnValue("/catalog");

    render(
      <SidebarNav user={{ id: 1, name: "Admin", email: "admin@lib.dev", role: "admin" }} />
    );

    expect(screen.getByRole("link", { name: "Catalog" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Admin Settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Catalog" }).className).toContain("active");
  });

  test("shows member-only navigation", () => {
    navMocks.usePathname.mockReturnValue("/member");

    render(
      <SidebarNav user={{ id: 2, name: "Member", email: "member@lib.dev", role: "member" }} />
    );

    expect(screen.getByRole("link", { name: "My Loans" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Admin Settings" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Borrowings" })).toBeNull();
  });
});
