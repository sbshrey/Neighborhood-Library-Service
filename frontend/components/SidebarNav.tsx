"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/catalog", label: "Catalog" },
  { href: "/users", label: "Users" },
  { href: "/loans", label: "Loans" },
  { href: "/roles", label: "Roles" },
  { href: "/audit", label: "Audit" },
  { href: "/settings", label: "Settings" }
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {navLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${active ? " active" : ""}`}
            data-testid={`nav-${link.label.toLowerCase()}`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
