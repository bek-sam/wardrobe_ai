import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { BrandMark } from "@/components/ui/BrandMark";

export function LegalHeader() {
  return (
    <header className="legal-header">
      <BrandMark />
      <Link href="/">
        <ArrowLeft size={15} /> Back home
      </Link>
    </header>
  );
}
