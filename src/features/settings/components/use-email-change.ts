import { useState } from "react";

import { requestJson } from "@/lib/api/request";

export function useEmailChange(onRequested: (message: string) => void) {
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/auth/email-change", {
        method: "POST",
        body: JSON.stringify({ newEmail }),
      });
      setNewEmail("");
      onRequested(
        "Check both inboxes. The change completes only after your current and new addresses each confirm it.",
      );
    } catch (cause) {
      // Kept generic on purpose: a distinguishable "already in use" would
      // confirm that some other account holds that address.
      setError(cause instanceof Error ? cause.message : "That email could not be used.");
    } finally {
      setPending(false);
    }
  }

  return { newEmail, setNewEmail, error, pending, submit };
}
