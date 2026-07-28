import { GearSix, SignOut } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { BrandMark } from "@/components/ui/BrandMark";

/**
 * The mobile layout has no sidebar, so sign-out would otherwise be reachable
 * only by navigating into Settings. It sits next to the settings link here so
 * the control is one tap away on a small screen too.
 */
export function MobileTopbar() {
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
