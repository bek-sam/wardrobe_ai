import type { ReactNode } from "react";

type BadgeTone = "neutral" | "rust" | "sage" | "gold" | "outline";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function PreviewBadge() {
  return <Badge tone="outline">Preview data</Badge>;
}
