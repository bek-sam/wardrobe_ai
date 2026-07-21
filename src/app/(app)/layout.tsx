import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/navigation/AppShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ProtectedAppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
