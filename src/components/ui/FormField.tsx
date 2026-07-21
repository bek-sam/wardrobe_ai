import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

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
