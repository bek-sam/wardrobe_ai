import { LockKey } from "@phosphor-icons/react/ssr";

/**
 * States plainly whether this deployment can actually authenticate anyone.
 *
 * Demo mode exists so the pages can be reviewed without a Supabase project,
 * and the honest thing is to say so: the note never claims sign-in is ready
 * when it is not, and never names a provider that is switched off.
 */
export function AuthConfigurationNote({
  configured,
  id,
  readyMessage,
}: {
  configured: boolean;
  id?: string;
  readyMessage: string;
}) {
  return (
    <p
      className={`auth-integration-note${configured ? " auth-integration-note--ready" : ""}`}
      id={id}
      role={configured ? undefined : "status"}
    >
      <LockKey aria-hidden="true" size={14} />{" "}
      {configured
        ? readyMessage
        : "Preview mode: this deployment has no account service configured, so sign-in is unavailable."}
    </p>
  );
}
