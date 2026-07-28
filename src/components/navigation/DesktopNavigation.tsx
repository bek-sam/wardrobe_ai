"use client";

import { BrandMark } from "@/components/ui/BrandMark";

import { NavLink } from "./NavLink";
import { SignOutForm } from "./SignOutForm";
import { primaryItems, secondaryItems } from "./nav-items.data";

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
