"use client";

import {
  CalendarBlank,
  ChartDonut,
  CoatHanger,
  GearSix,
  HouseLine,
  Sparkle,
  SquaresFour,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";

const primaryItems = [
  { href: "/today", label: "Today", icon: HouseLine },
  { href: "/wardrobe", label: "Wardrobe", icon: CoatHanger },
  { href: "/stylist", label: "Stylist", icon: Sparkle },
  { href: "/planner", label: "Planner", icon: CalendarBlank },
  { href: "/outfits", label: "Outfits", icon: SquaresFour },
  { href: "/insights", label: "Insights", icon: ChartDonut },
] as const;

const secondaryItems = [{ href: "/settings", label: "Settings", icon: GearSix }] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/today" && pathname.startsWith(`${href}/`));
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: Icon }) {
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

export function DesktopNavigation() {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <BrandMark href="/today" />
      </div>
      <nav className="app-nav" aria-label="Main navigation">
        <p className="app-nav__label">My wardrobe</p>
        {primaryItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
      <nav className="app-nav app-nav--secondary" aria-label="Account navigation">
        {secondaryItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
      <div className="app-sidebar__privacy">
        <span aria-hidden="true" />
        <p>
          <strong>Private by design</strong>Your wardrobe stays account-scoped.
        </p>
      </div>
    </aside>
  );
}

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

export function MobileTopbar() {
  return (
    <header className="mobile-topbar">
      <BrandMark compact href="/today" />
      <span>Wardrobe AI</span>
      <Link className="mobile-topbar__account" href="/settings" aria-label="Open settings">
        <GearSix size={20} aria-hidden="true" />
      </Link>
    </header>
  );
}
