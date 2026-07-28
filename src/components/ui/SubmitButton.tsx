"use client";

import { useFormStatus } from "react-dom";

import { Button } from "./Button";

/**
 * Submit button that disables itself while the form is in flight.
 *
 * `useFormStatus` reads the state of the enclosing form, so this works for the
 * plain server-POST forms used throughout auth without any client state. That
 * matters most on the destructive and email-sending flows, where a
 * double-click would otherwise send two confirmation emails or burn two
 * rate-limit slots.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  variant = "primary",
}: {
  children: string;
  pendingLabel: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      disabled={disabled || pending}
      fullWidth
      type="submit"
      variant={variant}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
