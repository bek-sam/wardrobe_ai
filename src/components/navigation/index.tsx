import { GearSix, SignOut } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui";
import { DesktopNavigation } from "./client";
import { MobileNavigation } from "./client";
import { ArrowRight } from "@phosphor-icons/react/ssr";

/**
 * The mobile layout has no sidebar, so sign-out would otherwise be reachable
 * only by navigating into Settings. It sits next to the settings link here so
 * the control is one tap away on a small screen too.
 */
function MobileTopbar() {
  return (
    <header className="mobile-topbar">
      <BrandMark compact href="/today" />
      <span>Wardrobe AI</span>
      <div className="mobile-topbar__actions">
        <Link className="mobile-topbar__account" href="/settings" aria-label="Open settings">
          <GearSix size={20} aria-hidden="true" />
        </Link>
        <form action="/api/auth/logout" method="post">
          <input name="scope" type="hidden" value="local" />
          <button className="mobile-topbar__account" type="submit" aria-label="Sign out">
            <SignOut size={20} aria-hidden="true" />
          </button>
        </form>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <DesktopNavigation />
      <div className="app-workspace">
        <MobileTopbar />
        <main className="app-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}

export function PublicHeader() {
  return (
    <header className="public-header">
      <BrandMark />
      <nav aria-label="Public navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <div className="public-header__actions">
        <Link className="public-header__login" href="/login">
          Log in
        </Link>
        <Link className="button button--primary button--small" href="/signup">
          Create account <ArrowRight size={15} />
        </Link>
      </div>
    </header>
  );
}
