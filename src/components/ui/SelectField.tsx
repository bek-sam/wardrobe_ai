import type { ReactNode, SelectHTMLAttributes } from "react";

import { FieldShell } from "./FieldShell";

export function SelectField({
  label,
  hint,
  optional,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  optional?: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <FieldShell hint={hint} htmlFor={id} label={label} optional={optional}>
      <select className="select-input" id={id} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}
