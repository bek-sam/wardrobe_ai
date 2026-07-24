"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive } from "./is-active";
import { primaryItems } from "./nav-items.data";

export function MobileNavigation() {
  const pathname = usePathname();
  const items = primaryItems.slice(0, 5);

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            className={active ? "is-active" : ""}
            href={href}
            key={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={21} weight={active ? "fill" : "regular"} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
