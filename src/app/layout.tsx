import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerCleanup } from "@/components/ServiceWorkerCleanup";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wardrobe AI — Dress for the day ahead",
    template: "%s · Wardrobe AI",
  },
  description:
    "A private wardrobe assistant that understands what you own, what your day requires, and how you like to dress.",
  applicationName: "Wardrobe AI",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport = { themeColor: "#6e302e", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
