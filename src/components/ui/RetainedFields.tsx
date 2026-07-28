"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Keeps the non-secret fields a user typed across a failed submission.
 *
 * Auth forms are server POSTs that answer with a 303, so the browser discards
 * everything typed — including the email address, which the user then has to
 * retype purely because their password was wrong.
 *
 * The obvious fix, echoing the value back in the redirect query string, is
 * exactly what the email policy forbids: it would put the address into browser
 * history, server logs, and the `Referer` of anything the page loads. So the
 * values are stashed in `sessionStorage` instead, which never leaves the tab
 * and is cleared when it closes.
 *
 * `names` must contain only non-secret fields. Passwords and one-time codes
 * are deliberately never retained: a rejected secret should be retyped, not
 * resubmitted, and keeping one in storage would outlive the request.
 */
export function RetainedFields({
  formId,
  names,
  children,
}: {
  formId: string;
  names: readonly string[];
  children: ReactNode;
}) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    for (const name of names) {
      const field = form.elements.namedItem(name);
      const stored = sessionStorage.getItem(`${formId}:${name}`);
      if (field instanceof HTMLInputElement && stored && !field.value) field.value = stored;
    }

    const save = () => {
      for (const name of names) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement) {
          sessionStorage.setItem(`${formId}:${name}`, field.value);
        }
      }
    };
    form.addEventListener("submit", save);
    return () => form.removeEventListener("submit", save);
  }, [formId, names]);

  return <>{children}</>;
}
