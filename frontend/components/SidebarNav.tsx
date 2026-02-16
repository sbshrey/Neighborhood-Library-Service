"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthUser } from "../lib/auth";

const staffLinks = [
  { href: "/", label: "Borrowings" },
  { href: "/fines", label: "Fines" },
];

const memberLinks = [
  { href: "/member", label: "My Loans" },
];

const adminLinks = [
  { href: "/", label: "Borrowings" },
  { href: "/fines", label: "Fines" },
  { href: "/settings", label: "Admin Settings" },
  { href: "/catalog", label: "Catalog" },
  { href: "/users", label: "Users" },
  { href: "/roles", label: "Roles" },
  { href: "/audit", label: "Audit" },
];

export default function SidebarNav({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const navLinks =
    user?.role === "admin" ? adminLinks : user?.role === "member" ? memberLinks : staffLinks;

  return (
    <nav className="nav">
      {navLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${active ? " active" : ""}`}
            data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
