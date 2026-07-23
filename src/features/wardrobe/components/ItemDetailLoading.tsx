import { ArrowLeft, SpinnerGap } from "@phosphor-icons/react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

export function ItemDetailLoading() {
  return (
    <div className="page-stack" aria-busy="true">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      <Card>
        <SpinnerGap className="spin" size={20} /> Loading private item…
      </Card>
    </div>
  );
}
