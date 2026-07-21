import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

interface ButtonLinkProps {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
}

function buttonClass(variant: ButtonVariant, fullWidth = false, className = "") {
  return ["button", `button--${variant}`, fullWidth ? "button--full" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, fullWidth, className)} type={type} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  fullWidth = false,
  className = "",
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, fullWidth, className)} href={href}>
      {children}
    </Link>
  );
}
