import type { ReactNode } from "react";

interface FieldShellProps {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

export function FieldShell({ label, htmlFor, hint, optional, children }: FieldShellProps) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor={htmlFor}>{label}</label>
        {optional ? <span>Optional</span> : null}
      </div>
      {children}
      {hint ? <p className="form-field__hint">{hint}</p> : null}
    </div>
  );
}
