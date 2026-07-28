import { useState } from "react";

import { requestJson } from "@/lib/api/request";

/**
 * Password change / first-password state.
 *
 * Every password field is cleared on both success and failure. Leaving a
 * rejected password in the input would keep the secret in the DOM, and would
 * invite the user to resubmit the value that was just refused.
 */
export function usePasswordPanel(hasPassword: boolean, onChanged: (message: string) => void) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function clear() {
    setCurrent("");
    setNext("");
    setConfirmation("");
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await requestJson(hasPassword ? "/api/auth/change-password" : "/api/auth/add-password", {
        method: "POST",
        body: JSON.stringify({
          ...(hasPassword ? { currentPassword: current } : {}),
          password: next,
          passwordConfirmation: confirmation,
        }),
      });
      clear();
      onChanged(
        hasPassword
          ? "Your password was changed and your other devices were signed out."
          : "A password was added. You can now sign in with your email address too.",
      );
    } catch (cause) {
      clear();
      setError(cause instanceof Error ? cause.message : "The password could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return {
    current,
    setCurrent,
    next,
    setNext,
    confirmation,
    setConfirmation,
    error,
    pending,
    submit,
  };
}
