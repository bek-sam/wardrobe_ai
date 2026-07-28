import { SignOut } from "@phosphor-icons/react/ssr";

/**
 * Local sign-out, reachable from the navigation on every screen.
 *
 * A plain form POST rather than a client handler: it works without JavaScript,
 * and it goes through the same origin-validated route as every other
 * state-changing request. `local` scope is the default because "sign out"
 * should mean this device — ending sessions on a user's other devices is a
 * deliberate choice made in Settings, not a surprise from the sidebar.
 */
export function SignOutForm({ className = "" }: { className?: string }) {
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
