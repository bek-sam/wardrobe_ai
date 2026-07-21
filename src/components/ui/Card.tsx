import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "article" | "section" | "div";
  padded?: boolean;
}

export function Card({
  children,
  as: Element = "div",
  padded = true,
  className = "",
  ...props
}: CardProps) {
  return (
    <Element
      className={["card", padded ? "card--padded" : "", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </Element>
  );
}
