"use client";

import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive } from "./is-active";

export function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: Icon }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      className={`app-nav__link${active ? " is-active" : ""}`}
      href={href}
      aria-current={active ? "page" : undefined}
    >
      <Icon aria-hidden="true" size={20} weight={active ? "fill" : "regular"} />
      <span>{label}</span>
    </Link>
  );
}
