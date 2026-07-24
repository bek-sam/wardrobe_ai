import type { TextareaHTMLAttributes } from "react";

import { FieldShell } from "./FieldShell";

export function TextareaField({
  label,
  hint,
  optional,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  optional?: boolean;
  id: string;
}) {
  return (
    <FieldShell hint={hint} htmlFor={id} label={label} optional={optional}>
      <textarea className="textarea-input" id={id} {...props} />
    </FieldShell>
  );
}
