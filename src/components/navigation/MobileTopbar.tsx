"use client";

import { GearSix } from "@phosphor-icons/react";
import Link from "next/link";

import { BrandMark } from "@/components/ui/BrandMark";

export function MobileTopbar() {
  return (
    <header className="mobile-topbar">
      <BrandMark compact href="/today" />
      <span>Wardrobe AI</span>
      <Link className="mobile-topbar__account" href="/settings" aria-label="Open settings">
        <GearSix size={20} aria-hidden="true" />
      </Link>
    </header>
  );
}
