"use client";

import { BrandMark } from "@/components/ui";
import { primaryItems, secondaryItems } from "./model";
import { SignOut } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "./model";
import { mobileItems } from "./model";

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

/**
 * Local sign-out, reachable from the navigation on every screen.
 *
 * A plain form POST rather than a client handler: it works without JavaScript,
 * and it goes through the same origin-validated route as every other
 * state-changing request. `local` scope is the default because "sign out"
 * should mean this device — ending sessions on a user's other devices is a
 * deliberate choice made in Settings, not a surprise from the sidebar.
 */
function SignOutForm({ className = "" }: { className?: string }) {
  return (
    <form action="/api/auth/logout" className={className} method="post">
      <input name="scope" type="hidden" value="local" />
      <button className="app-nav__link app-nav__link--signout" type="submit">
        <SignOut aria-hidden="true" size={20} />
        <span>Sign out</span>
      </button>
    </form>
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
        <SignOutForm />
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
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileItems.map(({ href, label, icon: Icon }) => {
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
