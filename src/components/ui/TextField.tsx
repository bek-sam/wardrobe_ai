import type { InputHTMLAttributes } from "react";

import { FieldShell } from "./FieldShell";

export function TextField({
  label,
  hint,
  optional,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  optional?: boolean;
  id: string;
}) {
  return (
    <FieldShell hint={hint} htmlFor={id} label={label} optional={optional}>
      <input className="text-input" id={id} {...props} />
    </FieldShell>
  );
}
