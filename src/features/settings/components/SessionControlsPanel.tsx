import { Button } from "@/components/ui/Button";

/**
 * The three sign-out scopes, each labelled by what it actually does.
 *
 * "Sign out" alone is ambiguous once an account can be signed in on several
 * devices, so each control names its reach. "Everywhere" asks for confirmation
 * because it ends the current session too — the user will have to sign back in
 * on the device they are holding.
 *
 * Plain forms, so these keep working if the client bundle fails to load. That
 * matters here more than elsewhere: signing out is what someone does when they
 * think something is wrong.
 */
export function SessionControlsPanel() {
  return (
    <div className="security-panel">
      <h3>Sessions</h3>
      <p>
        Signing out revokes the ability to refresh a session. Access already granted elsewhere can
        remain usable for up to an hour until it expires.
      </p>
      <div className="security-actions">
        <form action="/api/auth/logout" method="post">
          <input name="scope" type="hidden" value="local" />
          <Button type="submit" variant="secondary">
            Sign out this device
          </Button>
        </form>
        <form action="/api/auth/logout" method="post">
          <input name="scope" type="hidden" value="others" />
          <Button type="submit" variant="secondary">
            Sign out other devices
          </Button>
        </form>
        <form
          action="/api/auth/logout"
          method="post"
          onSubmit={(event) => {
            if (!window.confirm("Sign out everywhere, including this device?")) {
              event.preventDefault();
            }
          }}
        >
          <input name="scope" type="hidden" value="global" />
          <Button type="submit" variant="danger">
            Sign out everywhere
          </Button>
        </form>
      </div>
    </div>
  );
}
