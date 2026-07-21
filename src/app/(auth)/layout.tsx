import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <header className="auth-header">
        <BrandMark />
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <span>Private by design</span>
        <span>© 2026 Wardrobe AI</span>
      </footer>
    </div>
  );
}
