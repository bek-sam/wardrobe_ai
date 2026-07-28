"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useId, useState, type InputHTMLAttributes } from "react";

import { FieldShell } from "./FieldShell";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  id: string;
  /**
   * Password managers rely on this to tell "the password you have" apart from
   * "a password you are choosing", which is what makes them offer to save a
   * new one instead of autofilling the old one. Always passed explicitly.
   */
  autoComplete: "current-password" | "new-password";
};

export function PasswordField({ label, hint, id, ...props }: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const statusId = useId();

  return (
    <FieldShell hint={hint} htmlFor={id} label={label}>
      <div className="password-field">
        <input className="text-input" id={id} type={revealed ? "text" : "password"} {...props} />
        <button
          aria-controls={id}
          aria-describedby={statusId}
          className="password-field__toggle"
          onClick={() => setRevealed((current) => !current)}
          type="button"
        >
          {revealed ? (
            <EyeSlash aria-hidden="true" size={18} />
          ) : (
            <Eye aria-hidden="true" size={18} />
          )}
          <span className="sr-only">{revealed ? "Hide password" : "Show password"}</span>
        </button>
      </div>
      {/* Polite, so toggling visibility does not interrupt a screen reader
          mid-field, but the state change is still announced. */}
      <span className="sr-only" id={statusId} role="status">
        {revealed ? "Password is visible" : "Password is hidden"}
      </span>
    </FieldShell>
  );
}
