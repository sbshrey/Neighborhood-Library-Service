"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthUser } from "../lib/auth";

const staffLinks = [
  { href: "/", label: "Borrowings" },
];

const adminLinks = [
  { href: "/", label: "Borrowings" },
  { href: "/settings", label: "Admin Settings" },
];

export default function SidebarNav({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const navLinks = user?.role === "admin" ? adminLinks : staffLinks;

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
