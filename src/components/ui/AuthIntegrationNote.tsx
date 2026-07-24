import { LockKey } from "@phosphor-icons/react/ssr";

export function AuthIntegrationNote({
  configured,
  id,
  readyMessage,
  previewMessage,
  icon = true,
}: {
  configured: boolean;
  id?: string;
  readyMessage: string;
  previewMessage: string;
  icon?: boolean;
}) {
  return (
    <p
      className={`auth-integration-note${configured ? " auth-integration-note--ready" : ""}`}
      id={id}
      role={configured ? undefined : "status"}
    >
      {icon && (
        <>
          <LockKey size={14} />{" "}
        </>
      )}
      {configured ? readyMessage : previewMessage}
    </p>
  );
}
