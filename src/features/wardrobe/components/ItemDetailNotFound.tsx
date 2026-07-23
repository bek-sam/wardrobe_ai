import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ItemDetailNotFound({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="page-stack">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      <Card>
        <WarningCircle size={20} />
        <h1>Item unavailable</h1>
        <p>{error ?? "This item was not found in your wardrobe."}</p>
        <Button onClick={onRetry} variant="secondary">
          Try again
        </Button>
      </Card>
    </div>
  );
}
